const vscode = require('vscode');
const { randomBytes } = require('node:crypto');
const { getModelPricing } = require('./model-pricing');
const {
    getLearningDashboard,
    getModelRecommendations,
    normalizeScorecard,
    recordOutcome
} = require('./model-learning');

const LEARNING_STORAGE_KEY = 'agentRoster.modelLearning.scorecard.v1';
const dashboardRefreshers = new Set();

const MODEL_DISCOVERY_TIMEOUT_MS = 15_000;
function activate(context) {
    context.subscriptions.push(registerModelLearningTools(context));
    context.subscriptions.push(vscode.commands.registerCommand('agentRoster.openModelLearning', () => openModelLearning(context)));
    context.subscriptions.push(vscode.window.registerTreeDataProvider('agentRoster.modelLearning', {
        getChildren(element) {
            if (element) return [];
            const item = new vscode.TreeItem('Open Aro Learning', vscode.TreeItemCollapsibleState.None);
            item.command = {
                command: 'agentRoster.openModelLearning',
                title: 'Open Aro Learning'
            };
            return [item];
        },
        getTreeItem(item) {
            return item;
        }
    }));
}

function registerModelLearningTools(context) {
    const readTool = vscode.lm.registerTool('aroGetModelRecommendations', {
        prepareInvocation({ input }) {
            return { invocationMessage: `Reading learned model outcomes for ${input.role} / ${input.taskCategory}` };
        },
        async invoke({ input }) {
            const models = await vscode.lm.selectChatModels();
            const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
            const recommendations = getModelRecommendations(scorecard, {
                role: input.role,
                taskCategory: input.taskCategory,
                models: models.map(model => ({
                    id: model.id,
                    name: model.name,
                    vendor: model.vendor,
                    family: model.family,
                    version: model.version,
                    inputCost: model.inputCost,
                    outputCost: model.outputCost,
                    cacheCost: model.cacheCost,
                    cacheWriteCost: model.cacheWriteCost,
                    priceCategory: model.priceCategory
                })),
                getPricing: getModelPricing
            });
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(recommendations))
            ]);
        }
    });

    const recordTool = vscode.lm.registerTool('aroRecordModelOutcome', {
        prepareInvocation({ input }) {
            return { invocationMessage: `Recording verified ${input.outcome} for ${input.role} / ${input.taskCategory}` };
        },
        async invoke({ input }) {
            const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
            const next = recordOutcome(scorecard, input);
            await context.globalState.update(LEARNING_STORAGE_KEY, next);
            const matching = next.records.filter(record => record.role === input.role
                && record.taskCategory === input.taskCategory
                && record.modelId === input.modelId);
            const successes = matching.filter(record => record.outcome === 'success').length;
            const failures = matching.length - successes;
            for (const refresh of dashboardRefreshers) refresh();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({
                    stored: true,
                    modelId: input.modelId,
                    role: input.role,
                    taskCategory: input.taskCategory,
                    successes,
                    failures,
                    samples: matching.length,
                    score: Number(((successes + 1) / (matching.length + 2)).toFixed(3))
                }))
            ]);
        }
    });

    return {
        dispose() {
            readTool.dispose();
            recordTool.dispose();
        }
    };
}

function openModelLearning(context) {
    const panel = vscode.window.createWebviewPanel(
        'agentRosterModelLearning',
        'Aro Model Learning',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    let refreshPromise;
    const refresh = async () => {
        if (refreshPromise) return refreshPromise;
        panel.webview.postMessage({ type: 'learningDashboardLoading' });
        refreshPromise = (async () => {
            const models = await selectChatModelsWithTimeout();
            const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
            const summaries = models.map(model => ({
                id: model.id,
                name: model.name,
                vendor: model.vendor,
                family: model.family,
                version: model.version,
                inputCost: model.inputCost,
                outputCost: model.outputCost,
                cacheCost: model.cacheCost,
                cacheWriteCost: model.cacheWriteCost,
                priceCategory: model.priceCategory
            }));
            panel.webview.postMessage({
                type: 'learningDashboard',
                models: summaries.map(model => ({ ...model, pricing: getModelPricing(model) })),
                dashboard: getLearningDashboard(scorecard, summaries, getModelPricing),
                recordCount: scorecard.records.length
            });
        })().catch(error => {
            panel.webview.postMessage({ type: 'learningDashboardError', error: error instanceof Error ? error.message : String(error) });
        }).finally(() => { refreshPromise = undefined; });
        return refreshPromise;
    };

    dashboardRefreshers.add(refresh);
    panel.webview.onDidReceiveMessage(message => {
        if (message.type === 'ready' || message.type === 'refreshLearning') void refresh();
    }, null, context.subscriptions);
    panel.onDidDispose(() => dashboardRefreshers.delete(refresh), null, context.subscriptions);
    panel.webview.html = getLearningHtml(panel.webview, context.extensionUri);
}

async function selectChatModelsWithTimeout() {
    let timeout;
    try {
        return await Promise.race([
            vscode.lm.selectChatModels(),
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error(
                    'Model discovery timed out after 15 seconds. Check Copilot sign-in and model provider availability, then refresh.'
                )), MODEL_DISCOVERY_TIMEOUT_MS);
            })
        ]);
    } finally {
        clearTimeout(timeout);
    }
}

function getLearningHtml(webview, extensionUri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'model-learning-dashboard.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'model-learning-dashboard.css'));
    const nonce = randomBytes(16).toString('base64');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
    <title>Aro Model Learning</title>
</head>
<body>
  <header>
        <h1>Aro Model Learning</h1>
        <p>Recommendations improve from verified specialist outcomes by role and task type.</p>
  </header>
    <p class="notice">Aro records only the requested model ID, role, task category, outcome code, and worker name. It stores no prompts or responses. Aro will not record tool/environment failures as model failures. Runtime model resolution is not independently verified.</p>
  <main>
        <section>
            <div class="toolbar"><h2>Learned recommendations</h2><button id="refresh-learning" type="button">Refresh</button></div>
            <div id="learning-status" class="model-load-status is-loading" role="status" aria-live="polite" aria-busy="true">
                <span id="learning-message">Loading Aro's scorecard...</span>
            </div>
            <div class="table-wrap"><table><thead><tr><th>Role</th><th>Task</th><th>Recommended model</th><th>Price tier</th><th>Selection mode</th><th>Outcomes</th><th>Observed quality</th><th>Price source</th></tr></thead><tbody id="recommendations"></tbody></table></div>
            <details id="model-inventory">
                <summary>Model inventory <span id="model-count">0 models</span></summary>
                <div class="inventory-content"><div class="table-wrap"><table><thead><tr><th>Model</th><th>Provider / family</th><th>Price / 1M tokens</th><th>Tier</th><th>Source</th></tr></thead><tbody id="models"></tbody></table></div></div>
            </details>
        </section>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function deactivate() { }

module.exports = { activate, deactivate };