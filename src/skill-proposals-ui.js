const { randomBytes } = require('node:crypto');
const {
    completeAcceptance,
    dismissProposal,
    LIMITS,
    listProposals,
    prepareAcceptance,
    submitProposal,
    updateProposal
} = require('./skill-proposals');

const OPEN_COMMAND = 'agentRoster.openSkillProposals';
const TOOL_NAME = 'aroProposeSkill';
const SKILLS_FOLDER = ['.github', 'skills'];
const encode = text => new TextEncoder().encode(text);

// Names of skills shipped in this package, so a proposal cannot shadow one.
function getReservedNames(context) {
    const entries = context.extension?.packageJSON?.contributes?.chatSkills;
    return Array.isArray(entries)
        ? entries.map(entry => String(entry?.path || '').split('/').slice(-2, -1)[0]).filter(Boolean)
        : [];
}

function isNotFound(error) {
    return error && (error.code === 'FileNotFound' || error.name === 'EntryNotFound (FileSystemError)');
}

function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}

// `vscode` is injected so this module stays loadable without the extension host.
function registerSkillProposals(vscode, context, { onChange = () => { } } = {}) {
    const panels = new Set();
    const reservedNames = getReservedNames(context);
    const store = context.globalState;

    const snapshot = () => listProposals(store).map(({ id, name, description, body, rationale, createdAt }) => ({ id, name, description, body, rationale, createdAt }));
    const publish = () => {
        for (const panel of panels) panel.webview.postMessage({ type: 'skillProposals', proposals: snapshot(), limits: LIMITS });
        onChange();
    };

    async function pickFolder() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) throw new Error('Open a folder first: skills are created in the workspace under .github/skills.');
        if (folders.length === 1) return folders[0];
        const folder = await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Choose the workspace folder that should receive the skill' });
        if (!folder) throw new Error('No workspace folder was chosen.');
        return folder;
    }

    async function exists(uri) {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
    }

    async function accept(id, edits) {
        const prepared = prepareAcceptance(store, id, edits, { reservedNames });
        if (!prepared.ok) return prepared;
        const folder = await pickFolder();
        const directory = vscode.Uri.joinPath(folder.uri, ...SKILLS_FOLDER, prepared.value.name);
        const file = vscode.Uri.joinPath(directory, 'SKILL.md');
        const relative = [...SKILLS_FOLDER, prepared.value.name, 'SKILL.md'].join('/');
        if (await exists(directory)) return { ok: false, errors: [`${relative} already exists. Choose another name; nothing was written.`] };
        const choice = await vscode.window.showWarningMessage(
            `Create skill "${prepared.value.name}"?`,
            { modal: true, detail: `This writes ${relative} in ${folder.name}. The skill becomes available to Copilot once created.` },
            'Create Skill'
        );
        if (choice !== 'Create Skill') return { ok: false, cancelled: true, errors: [] };
        let result;
        try {
            result = await completeAcceptance(store, id, async () => {
                // Checked again inside the serialized step because the confirmation dialog can stay open for a long time.
                if (await exists(directory)) throw new Error(`${relative} already exists. Nothing was written.`);
                await vscode.workspace.fs.createDirectory(directory);
                await vscode.workspace.fs.writeFile(file, encode(prepared.markdown));
            });
        } catch (error) {
            return { ok: false, errors: [messageOf(error)] };
        }
        if (result.ok) void vscode.window.showInformationMessage(`Created ${relative}.`);
        return result;
    }

    async function dismiss(id) {
        const current = listProposals(store).find(proposal => proposal.id === id);
        if (!current) return { ok: false, errors: ['The proposal no longer exists.'] };
        const choice = await vscode.window.showWarningMessage(
            `Dismiss the proposal "${current.name}"?`,
            { modal: true, detail: 'The draft is deleted and no skill is created.' },
            'Dismiss'
        );
        if (choice !== 'Dismiss') return { ok: false, cancelled: true, errors: [] };
        return dismissProposal(store, id);
    }

    function openPanel() {
        const panel = vscode.window.createWebviewPanel('agentRosterSkillProposals', 'Aro Skill Proposals', vscode.ViewColumn.One, { enableScripts: true });
        panels.add(panel);
        const reply = (type, extra = {}) => panel.webview.postMessage({ type, ...extra });
        panel.webview.onDidReceiveMessage(async message => {
            if (!message || typeof message !== 'object') return;
            if (message.type === 'ready') {
                reply('skillProposals', { proposals: snapshot(), limits: LIMITS });
                return;
            }
            if (typeof message.id !== 'string') return;
            const edits = message.edits && typeof message.edits === 'object' ? message.edits : {};
            let result;
            try {
                if (message.type === 'save') result = await updateProposal(store, message.id, edits, { reservedNames });
                else if (message.type === 'accept') result = await accept(message.id, edits);
                else if (message.type === 'dismiss') result = await dismiss(message.id);
                else return;
            } catch (error) {
                result = { ok: false, errors: [messageOf(error)] };
            }
            if (result.ok) {
                publish();
                reply('skillProposalResult', { id: message.id, action: message.type, ok: true });
            } else if (!result.cancelled) {
                reply('skillProposalResult', { id: message.id, action: message.type, ok: false, errors: result.errors });
            } else {
                reply('skillProposalResult', { id: message.id, action: message.type, ok: false, cancelled: true, errors: [] });
            }
        }, null, context.subscriptions);
        panel.onDidDispose(() => panels.delete(panel), null, context.subscriptions);
        panel.webview.html = getHtml(vscode, panel.webview, context.extensionUri);
        return panel;
    }

    const tool = vscode.lm.registerTool(TOOL_NAME, {
        prepareInvocation({ input }) {
            return { invocationMessage: `Queueing skill proposal "${String(input?.name ?? '').slice(0, 64)}" for user review` };
        },
        async invoke({ input }) {
            const result = await submitProposal(store, input, { reservedNames });
            const text = result.ok
                ? { stored: true, id: result.proposal.id, name: result.proposal.name, status: 'pending-review', note: 'Queued for user review. No skill exists until the user approves it.' }
                : { stored: false, errors: result.errors };
            if (result.ok) {
                publish();
                void vscode.window.showInformationMessage(`Aro proposed a skill: ${result.proposal.name}`, 'Review').then(choice => {
                    if (choice === 'Review') return vscode.commands.executeCommand(OPEN_COMMAND);
                });
            }
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(text))]);
        }
    });

    const command = vscode.commands.registerCommand(OPEN_COMMAND, openPanel);
    return { dispose() { tool.dispose(); command.dispose(); } };
}

function getHtml(vscode, webview, extensionUri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'skill-proposals.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'model-learning-dashboard.css'));
    const proposalStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'skill-proposals.css'));
    const nonce = randomBytes(16).toString('base64');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <link rel="stylesheet" href="${proposalStyleUri}">
  <title>Aro Skill Proposals</title>
</head>
<body>
  <header>
    <h1>Aro Skill Proposals</h1>
    <p>Aro can queue a draft skill here. Nothing becomes a skill until you accept it; accepting writes <code>.github/skills/&lt;name&gt;/SKILL.md</code> in a workspace folder after you confirm. Drafts stay on this machine.</p>
  </header>
  <main>
    <div id="proposal-status" class="model-load-status is-loading" role="status" aria-live="polite" aria-busy="true"><span id="proposal-message">Loading proposals...</span></div>
    <div id="proposal-layout" class="proposal-layout">
      <ul id="proposal-list" class="proposal-list" aria-label="Pending proposals"></ul>
      <form id="proposal-form" class="proposal-form" hidden>
        <label>Name <input id="proposal-name" type="text" maxlength="${LIMITS.name}" autocomplete="off" spellcheck="false"></label>
        <label>Description <textarea id="proposal-description" rows="3" maxlength="${LIMITS.description}"></textarea></label>
        <label>Instructions <textarea id="proposal-body" rows="18" maxlength="${LIMITS.body}" spellcheck="false"></textarea></label>
        <p id="proposal-rationale" class="proposal-rationale"></p>
        <p id="proposal-errors" class="proposal-errors" role="alert"></p>
        <div class="proposal-actions">
          <button id="proposal-save" type="button">Save changes</button>
          <button id="proposal-accept" type="button">Accept and create skill...</button>
          <button id="proposal-dismiss" type="button">Dismiss</button>
        </div>
      </form>
    </div>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

module.exports = { OPEN_COMMAND, registerSkillProposals, TOOL_NAME };
