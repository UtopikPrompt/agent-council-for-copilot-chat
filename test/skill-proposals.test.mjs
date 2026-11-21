import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { parseCustomization, root } from '../scripts/validate.mjs';

const localRequire = createRequire(path.join(root, 'src/extension.js'));
const proposals = localRequire('../src/skill-proposals.js');
const { SKILL_PROPOSALS_KEY } = proposals;
const plain = value => JSON.parse(JSON.stringify(value));

const draft = (overrides = {}) => ({
    name: 'release-notes-review',
    description: 'Review release notes for accuracy. Use when drafting a changelog.',
    body: '# Release Notes Review\n\n1. Compare notes with merged changes.\n2. Flag unverified claims.',
    rationale: 'The same checklist was rebuilt three times.',
    ...overrides
});

function memoryStore(initial) {
    const state = new Map(initial ? [[SKILL_PROPOSALS_KEY, initial]] : []);
    return { state, get: key => state.get(key), update: async (key, value) => { value === undefined ? state.delete(key) : state.set(key, plain(value)); } };
}

test('a valid proposal is stored once and generates a SKILL.md the repository validator accepts', async () => {
    const store = memoryStore();
    const result = await proposals.submitProposal(store, draft());
    assert.equal(result.ok, true);
    assert.equal(proposals.listProposals(store).length, 1);
    const prepared = proposals.prepareAcceptance(store, result.proposal.id, {});
    assert.equal(prepared.ok, true);
    const parsed = parseCustomization(prepared.markdown, 'generated');
    assert.equal(parsed.metadata.name, 'release-notes-review');
    assert.equal(parsed.metadata.description, draft().description);
    assert.equal(parsed.body.trim(), draft().body);
});

test('descriptions with YAML-significant text round-trip through the generated frontmatter', async () => {
    const description = 'Use for: "quotes", # hashes, - dashes, {braces} & \'apostrophes\' \\ backslashes';
    const store = memoryStore();
    const { proposal } = await proposals.submitProposal(store, draft({ description }));
    const prepared = proposals.prepareAcceptance(store, proposal.id, {});
    assert.equal(parseCustomization(prepared.markdown, 'generated').metadata.description, description);
});

test('invalid names, descriptions and bodies are rejected with every error and nothing is stored', async () => {
    const store = memoryStore();
    for (const name of ['', 'Upper', 'under_score', '-lead', 'trail-', 'double--hyphen', 'a'.repeat(65), '../escape', 'with space', 'a/b']) {
        const result = await proposals.submitProposal(store, draft({ name }));
        assert.equal(result.ok, false, `accepted name ${JSON.stringify(name)}`);
    }
    const multi = await proposals.submitProposal(store, { name: 'Bad Name', description: 'line\nbreak', body: '  ' });
    assert.equal(multi.ok, false);
    assert.equal(multi.errors.length, 3);
    for (const overrides of [{ description: 'x'.repeat(1025) }, { description: 'a\u2028b' }, { body: 'x'.repeat(20_001) }, { body: 'a\u0000b' }, { rationale: 'x'.repeat(1001) }, { rationale: 5 }]) {
        assert.equal((await proposals.submitProposal(store, draft(overrides))).ok, false);
    }
    assert.equal(store.state.has(SKILL_PROPOSALS_KEY), false);
});

test('duplicate pending names, packaged names and the pending cap are rejected', async () => {
    const store = memoryStore();
    assert.equal((await proposals.submitProposal(store, draft())).ok, true);
    const duplicate = await proposals.submitProposal(store, draft());
    assert.match(duplicate.errors.join(), /already used by a pending proposal/);
    const packaged = await proposals.submitProposal(store, draft({ name: 'progressive-investigation' }), { reservedNames: ['progressive-investigation'] });
    assert.match(packaged.errors.join(), /packaged skill/);
    for (let index = 1; index < proposals.LIMITS.pending; index += 1) {
        assert.equal((await proposals.submitProposal(store, draft({ name: `skill-${index}` }))).ok, true);
    }
    assert.match((await proposals.submitProposal(store, draft({ name: 'one-too-many' }))).errors.join(), /pending proposals/);
});

test('concurrent submissions are serialized without losing proposals', async () => {
    const store = memoryStore();
    const results = await Promise.all(Array.from({ length: 5 }, (_, index) => proposals.submitProposal(store, draft({ name: `parallel-${index}` }))));
    assert.ok(results.every(result => result.ok));
    assert.equal(proposals.listProposals(store).length, 5);
});

test('edits are validated against other pending names and corrupt stored entries are ignored', async () => {
    const store = memoryStore();
    const first = (await proposals.submitProposal(store, draft())).proposal;
    const second = (await proposals.submitProposal(store, draft({ name: 'second-skill' }))).proposal;
    assert.equal((await proposals.updateProposal(store, second.id, { name: first.name })).ok, false);
    assert.equal((await proposals.updateProposal(store, first.id, { name: first.name, body: 'Updated body.' })).ok, true);
    assert.equal(proposals.listProposals(store).find(entry => entry.id === first.id).body, 'Updated body.');
    store.state.set(SKILL_PROPOSALS_KEY, [...store.state.get(SKILL_PROPOSALS_KEY), { id: 'x', name: '../bad', description: 'd', body: 'b' }, null, 'junk']);
    assert.equal(proposals.listProposals(store).length, 2);
});

test('a failed write keeps the proposal and a successful write removes it', async () => {
    const store = memoryStore();
    const { proposal } = await proposals.submitProposal(store, draft());
    await assert.rejects(proposals.completeAcceptance(store, proposal.id, async () => { throw new Error('disk full'); }), /disk full/);
    assert.equal(proposals.listProposals(store).length, 1);
    assert.equal((await proposals.completeAcceptance(store, proposal.id, async () => {})).ok, true);
    assert.equal(proposals.listProposals(store).length, 0);
    assert.equal((await proposals.completeAcceptance(store, proposal.id, async () => assert.fail('must not write twice'))).ok, false);
});

async function loadHarness({ state = new Map(), folders = [{ name: 'repo', uri: 'file:///repo' }], files = new Set(), confirm = 'Create Skill', onConfirm } = {}) {
    const commands = new Map();
    const tools = new Map();
    const messages = { info: [], error: [] };
    const written = [];
    const posted = [];
    const prompts = [];
    let panels = 0;
    let receive;
    let info = () => Promise.resolve(undefined);
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const vscode = {
        EventEmitter: class { constructor() { this.event = () => ({ dispose() {} }); } fire() {} dispose() {} },
        TreeItem: class { constructor(label) { this.label = label; } },
        TreeItemCollapsibleState: { None: 0 },
        ThemeIcon: class { constructor(id) { this.id = id; } },
        lm: {
            registerTool: (name, tool) => { tools.set(name, tool); return { dispose() {} }; },
            selectChatModels: async () => []
        },
        workspace: {
            workspaceFolders: folders,
            getConfiguration: () => ({ get: (key, fallback) => fallback, inspect: () => undefined }),
            onDidChangeConfiguration: () => ({ dispose() {} }),
            fs: {
                stat: async uri => { if (files.has(uri)) return {}; throw Object.assign(new Error('missing'), { code: 'FileNotFound' }); },
                createDirectory: async uri => { files.add(uri); },
                writeFile: async (uri, bytes) => { written.push({ uri, text: Buffer.from(bytes).toString('utf8') }); files.add(uri); }
            }
        },
        commands: { registerCommand: (name, callback) => { commands.set(name, callback); return { dispose() {} }; }, executeCommand: async (name, ...args) => commands.get(name)?.(...args) },
        window: {
            registerTreeDataProvider: () => ({ dispose() {} }),
            showInformationMessage: (...args) => { messages.info.push(args); return info(...args); },
            showErrorMessage: message => { messages.error.push(message); },
            showWarningMessage: async (...args) => {
                prompts.push(args);
                await onConfirm?.();
                return confirm === 'Dismiss' ? args[2] : confirm;
            },
            showWorkspaceFolderPick: async () => folders[1],
            createWebviewPanel: () => {
                panels += 1;
                return {
                    webview: { cspSource: 'test', asWebviewUri: uri => uri, onDidReceiveMessage: handler => { receive = handler; }, postMessage: message => { posted.push(message); } },
                    onDidDispose() {}
                };
            }
        },
        Uri: { joinPath: (base, ...parts) => [base, ...parts].join('/') },
        ViewColumn: { One: 1 },
        LanguageModelTextPart: class { constructor(value) { this.value = value; } },
        LanguageModelToolResult: class { constructor(content) { this.content = content; } }
    };
    const module = { exports: {} };
    vm.runInNewContext(await readFile(path.join(root, 'src/extension.js'), 'utf8'), {
        module, exports: module.exports, TextEncoder,
        require: name => name === 'vscode' ? vscode : localRequire(name), setTimeout, clearTimeout
    });
    const context = {
        subscriptions: [], extensionUri: 'extension', extension: { packageJSON: manifest },
        globalState: { get: key => state.get(key), update: async (key, value) => { value === undefined ? state.delete(key) : state.set(key, plain(value)); } }
    };
    module.exports.activate(context);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    return {
        state, files, written, posted, prompts, messages, commands, context, manifest,
        get panels() { return panels; },
        setInfo: handler => { info = handler; },
        submit: async input => JSON.parse((await tools.get('aroProposeSkill').invoke({ input })).content[0].value),
        open: () => { posted.length = 0; commands.get('agentRoster.openSkillProposals')(); },
        send: async message => { posted.length = 0; await receive(message); await settle(); return posted.slice(); },
        get stored() { return plain(state.get(SKILL_PROPOSALS_KEY) || []); }
    };
}

test('Aro submits through the contributed tool; the draft persists across a reload and nothing is written', async () => {
    const harness = await loadHarness();
    harness.setInfo(() => Promise.resolve('Review'));
    const result = await harness.submit(draft());
    assert.equal(result.stored, true);
    assert.equal(result.status, 'pending-review');
    assert.equal(harness.written.length, 0);
    assert.deepEqual(plain(harness.messages.info[0]), ['Aro proposed a skill: release-notes-review', 'Review']);

    const reloaded = await loadHarness({ state: harness.state });
    reloaded.open();
    const [list] = await reloaded.send({ type: 'ready' });
    assert.deepEqual(list.proposals.map(entry => entry.name), ['release-notes-review']);
    assert.equal(reloaded.written.length, 0);
});

test('an invalid submission returns errors to Aro instead of storing or notifying', async () => {
    const harness = await loadHarness();
    const result = await harness.submit(draft({ name: 'Bad Name' }));
    assert.equal(result.stored, false);
    assert.ok(result.errors.length > 0);
    assert.equal(harness.stored.length, 0);
    assert.equal(harness.messages.info.length, 0);
    const packaged = await harness.submit(draft({ name: 'progressive-investigation' }));
    assert.match(packaged.errors.join(), /packaged skill/);
});

test('the review notification opens the review panel', async () => {
    const harness = await loadHarness();
    harness.setInfo(() => Promise.resolve('Review'));
    await harness.submit(draft());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.panels, 1);
});

test('edit, save and accept write a validated skill only after confirmation', async () => {
    const harness = await loadHarness();
    const { id } = await harness.submit(draft());
    harness.open();
    await harness.send({ type: 'ready' });

    let messages = await harness.send({ type: 'save', id, edits: { description: 'Edited description.' } });
    assert.equal(messages.find(message => message.type === 'skillProposalResult').ok, true);
    assert.equal(harness.stored[0].description, 'Edited description.');

    const declined = await loadHarness({ state: harness.state, confirm: null });
    declined.open();
    messages = await declined.send({ type: 'accept', id, edits: { body: 'Edited body.' } });
    assert.equal(messages.find(message => message.type === 'skillProposalResult').cancelled, true);
    assert.equal(declined.written.length, 0);
    assert.equal(declined.stored.length, 1);
    assert.equal(declined.stored[0].body, draft().body);

    harness.open();
    messages = await harness.send({ type: 'accept', id, edits: { body: 'Edited body.' } });
    assert.equal(messages.find(message => message.type === 'skillProposalResult').ok, true);
    assert.equal(harness.prompts.length, 1);
    assert.equal(harness.prompts[0][1].modal, true);
    assert.match(harness.prompts[0][1].detail, /\.github\/skills\/release-notes-review\/SKILL\.md/);
    assert.equal(harness.written.length, 1);
    assert.equal(harness.written[0].uri, 'file:///repo/.github/skills/release-notes-review/SKILL.md');
    const parsed = parseCustomization(harness.written[0].text, 'written');
    assert.equal(parsed.metadata.name, 'release-notes-review');
    assert.equal(parsed.metadata.description, 'Edited description.');
    assert.equal(parsed.body.trim(), 'Edited body.');
    assert.equal(harness.stored.length, 0);
});

test('accepting refuses invalid edits, existing skills and missing folders without writing or discarding the draft', async () => {
    const existing = new Set(['file:///repo/.github/skills/release-notes-review']);
    const harness = await loadHarness({ files: existing });
    const { id } = await harness.submit(draft());
    harness.open();

    let messages = await harness.send({ type: 'accept', id, edits: { name: '../evil' } });
    assert.equal(messages.find(message => message.type === 'skillProposalResult').ok, false);
    messages = await harness.send({ type: 'accept', id, edits: { name: 'progressive-investigation' } });
    assert.match(messages.find(message => message.type === 'skillProposalResult').errors.join(), /packaged skill/);
    messages = await harness.send({ type: 'accept', id, edits: {} });
    assert.match(messages.find(message => message.type === 'skillProposalResult').errors.join(), /already exists/);
    assert.equal(harness.prompts.length, 0);
    assert.equal(harness.written.length, 0);
    assert.equal(harness.stored.length, 1);

    const noFolder = await loadHarness({ folders: null });
    const created = await noFolder.submit(draft());
    noFolder.open();
    messages = await noFolder.send({ type: 'accept', id: created.id, edits: {} });
    assert.match(messages.find(message => message.type === 'skillProposalResult').errors.join(), /Open a folder/);
    assert.equal(noFolder.stored.length, 1);
});

test('a skill created while the confirmation was open is not overwritten', async () => {
    const files = new Set();
    const harness = await loadHarness({ files, onConfirm: () => { files.add('file:///repo/.github/skills/release-notes-review'); } });
    const { id } = await harness.submit(draft());
    harness.open();
    const messages = await harness.send({ type: 'accept', id, edits: {} });
    assert.equal(harness.prompts.length, 1);
    assert.match(messages.find(message => message.type === 'skillProposalResult').errors.join(), /already exists/);
    assert.equal(harness.written.length, 0);
    assert.equal(harness.stored.length, 1);
});

test('dismiss deletes the draft only after confirmation and never writes a skill', async () => {
    const harness = await loadHarness({ confirm: null });
    const { id } = await harness.submit(draft());
    harness.open();
    let messages = await harness.send({ type: 'dismiss', id });
    assert.equal(messages.find(message => message.type === 'skillProposalResult').cancelled, true);
    assert.equal(harness.stored.length, 1);

    const dismissing = await loadHarness({ state: harness.state, confirm: 'Dismiss' });
    dismissing.open();
    messages = await dismissing.send({ type: 'dismiss', id });
    assert.equal(messages.find(message => message.type === 'skillProposalResult').ok, true);
    assert.equal(dismissing.stored.length, 0);
    assert.equal(dismissing.written.length, 0);
});

test('a multi-root workspace asks which folder receives the skill', async () => {
    const harness = await loadHarness({ folders: [{ name: 'a', uri: 'file:///a' }, { name: 'b', uri: 'file:///b' }] });
    const { id } = await harness.submit(draft());
    harness.open();
    await harness.send({ type: 'accept', id, edits: {} });
    assert.equal(harness.written[0].uri, 'file:///b/.github/skills/release-notes-review/SKILL.md');
});

test('the skill inbox is contributed, reachable by Aro, local-only and uses stable APIs', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const tool = manifest.contributes.languageModelTools.find(entry => entry.name === 'aroProposeSkill');
    assert.ok(tool);
    assert.equal(tool.toolReferenceName, 'aroProposeSkill');
    assert.deepEqual(tool.inputSchema.required, ['name', 'description', 'body']);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(manifest.contributes.commands.some(command => command.command === 'agentRoster.openSkillProposals'));
    assert.ok(manifest.activationEvents.includes('onLanguageModelTool:aroProposeSkill'));
    assert.ok(manifest.activationEvents.includes('onCommand:agentRoster.openSkillProposals'));
    assert.equal(manifest.enabledApiProposals, undefined);
    const aro = parseCustomization(await readFile(path.join(root, 'agents/Aro.agent.md'), 'utf8'), 'Aro');
    assert.ok(aro.metadata.tools.includes(`${manifest.publisher}.${manifest.name}/aroProposeSkill`));
    assert.match(aro.body, /submit the complete draft with `aroProposeSkill`/);
    assert.match(aro.body, /nothing becomes a skill until\s+they accept it/);
    assert.match(aro.body, /Never create an agent, skill, issue, or project automatically/);
    const sources = (await Promise.all(['src/skill-proposals.js', 'src/skill-proposals-ui.js', 'media/skill-proposals.js'].map(file => readFile(path.join(root, file), 'utf8')))).join('\n');
    assert.doesNotMatch(sources, /fetch\(|https?:\/\/|XMLHttpRequest|require\('(?:node:)?(?:http|https|net)'\)|globalStorageUri|User[\\/]prompts|innerHTML|insertAdjacentHTML/);
    assert.doesNotMatch(sources, /enabledApiProposals|registerSkill\b|vscode\.chat\./);
    const packagedSkills = manifest.contributes.chatSkills.map(entry => entry.path);
    assert.equal(packagedSkills.length, 10);
    assert.ok(packagedSkills.every(entry => entry.startsWith('./skills/')));
});

test('the sidebar shows the pending proposal count', async () => {
    const harness = await loadHarness();
    await harness.submit(draft());
    const provider = harness.context.subscriptions.find(subscription => typeof subscription.getChildren === 'function');
    const rows = await provider.getChildren();
    const row = rows.find(item => item.label === 'Skill proposals');
    assert.equal(row.description, '1 pending');
    assert.equal(row.command.command, 'agentRoster.openSkillProposals');
});
