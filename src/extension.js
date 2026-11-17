const vscode = require('vscode');
const { randomBytes } = require('node:crypto');
const { effectiveModelScope, getManagedPricing, hasSelectedLocalModel, isCopilotCloudVendor, isModelSelected, modelKey, modelKind, selectModels } = require('./model-pricing');
const {
    getLearningDashboard,
    getModelRecommendations,
    normalizeScorecard,
    recordOutcome
} = require('./model-learning');

const LEARNING_STORAGE_KEY = 'agentRoster.modelLearning.scorecard.v1';
const INVENTORY_STORAGE_KEY = 'agentRoster.modelLearning.inventory.v1';
const dashboardRefreshers = new Set();

const MODEL_DISCOVERY_TIMEOUT_MS = 15_000;
function getInventoryPolicy(context) {
    const stored = context.globalState.get(INVENTORY_STORAGE_KEY) || {};
    return {
        scope: ['cloud', 'local'].includes(stored.scope) ? stored.scope : 'both',
        priority: ['local-first', 'cloud-first'].includes(stored.priority)
            ? stored.priority : stored.scope === 'local-first' ? 'local-first' : 'cloud-first',
        classifications: stored.classifications && typeof stored.classifications === 'object' && !Array.isArray(stored.classifications)
            ? stored.classifications : {},
        providerTypes: stored.providerTypes && typeof stored.providerTypes === 'object' && !Array.isArray(stored.providerTypes) ? stored.providerTypes : {},
        selections: stored.selections && typeof stored.selections === 'object' && !Array.isArray(stored.selections) ? stored.selections : {},
        localTiers: stored.localTiers && typeof stored.localTiers === 'object' && !Array.isArray(stored.localTiers) ? stored.localTiers : {},
        manualPriceTiers: stored.manualPriceTiers && typeof stored.manualPriceTiers === 'object' && !Array.isArray(stored.manualPriceTiers) ? stored.manualPriceTiers : {},
        localModelVendors: vscode.workspace.getConfiguration('agentRoster.modelLearning').get('localModelVendors', [])
    };
}

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
            const policy = getInventoryPolicy(context);
            const availableModels = await vscode.lm.selectChatModels();
            const scope = effectiveModelScope(availableModels, policy);
            const models = selectModels(availableModels, policy.localModelVendors, policy.classifications, scope, { ...policy, taskCategory: input.taskCategory });
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
                getPricing: model => getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes, policy.manualPriceTiers),
                getModelKind: model => modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes),
                preference: scope === 'both' ? policy.priority === 'local-first' ? 'local' : 'cloud' : undefined
            });
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ ...recommendations, modelScope: scope, modelPriority: scope === 'both' ? policy.priority : null }))
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
    let inventoryModels = [];
    let updatePromise = Promise.resolve();
    const refresh = async () => {
        if (refreshPromise) return refreshPromise;
        panel.webview.postMessage({ type: 'learningDashboardLoading' });
        refreshPromise = (async () => {
            const policy = getInventoryPolicy(context);
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
            inventoryModels = summaries;
            const scope = effectiveModelScope(summaries, policy);
            panel.webview.postMessage({
                type: 'learningDashboard',
                scope,
                priority: policy.priority,
                hasSelectedLocalModel: hasSelectedLocalModel(summaries, policy),
                models: summaries.map(model => ({
                    ...model,
                    kind: modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes),
                    selected: isModelSelected(model, policy.localModelVendors, policy.classifications, policy.selections, policy.providerTypes),
                    localTier: policy.localTiers[modelKey(model)] || 'unrated',
                    pricing: getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes, policy.manualPriceTiers)
                })),
                providerTypes: Object.fromEntries([...new Set(summaries.map(model => model.vendor))].map(vendor => [vendor, isCopilotCloudVendor(vendor) ? 'cloud' : policy.providerTypes[vendor] || (policy.localModelVendors.includes(vendor) ? 'local' : 'unknown')])),
                lockedProviders: [...new Set(summaries.map(model => model.vendor).filter(isCopilotCloudVendor))],
                dashboard: getLearningDashboard(scorecard, summaries, model => getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes, policy.manualPriceTiers), {
                    getModelsForTask: taskCategory => selectModels(summaries, policy.localModelVendors, policy.classifications, scope, { ...policy, taskCategory }),
                    getModelKind: model => modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes),
                    preference: scope === 'both' ? policy.priority === 'local-first' ? 'local' : 'cloud' : undefined
                }),
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
        if (['setModelScope', 'setModelPriority', 'setModelSelected', 'setProviderSelected', 'setProviderType', 'setLocalTier', 'setManualPriceTier'].includes(message.type)) {
            updatePromise = updatePromise.then(async () => {
                const policy = getInventoryPolicy(context);
                if (message.type === 'setModelScope') {
                    if (!['cloud', 'local', 'both'].includes(message.scope)) throw new Error('Invalid model scope.');
                    if (message.scope !== 'cloud' && !hasSelectedLocalModel(inventoryModels, policy)) throw new Error('Select a local model before using this scope.');
                    policy.scope = message.scope;
                } else if (message.type === 'setModelPriority') {
                    if (!['local-first', 'cloud-first'].includes(message.priority)) throw new Error('Invalid model priority.');
                    if (effectiveModelScope(inventoryModels, policy) !== 'both') throw new Error('Model priority is available only when both scopes are selected.');
                    policy.priority = message.priority;
                } else if (['setModelSelected', 'setLocalTier', 'setManualPriceTier'].includes(message.type)) {
                    const model = inventoryModels.find(item => item.id === message.id && item.vendor === message.vendor);
                    if (!model) throw new Error('Model is no longer available. Refresh the inventory.');
                    const key = modelKey(model);
                    if (message.type === 'setModelSelected') {
                        if (typeof message.selected !== 'boolean') throw new Error('Invalid selection.');
                        policy.selections = { ...policy.selections, [key]: message.selected };
                    } else if (message.type === 'setLocalTier') {
                        if (!['unrated', 'simple', 'standard', 'complex'].includes(message.tier)) throw new Error('Invalid local model tier.');
                        if (modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes) !== 'local') throw new Error('Only local models have capability tiers.');
                        policy.localTiers = { ...policy.localTiers, [key]: message.tier };
                    } else {
                        if (!['unpriced', 'low', 'medium', 'high'].includes(message.tier)) throw new Error('Invalid price tier.');
                        if (message.tier !== 'unpriced' && getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes).source !== 'unpriced') throw new Error('Manual price tiers apply only to unpriced models.');
                        policy.manualPriceTiers = { ...policy.manualPriceTiers };
                        if (message.tier === 'unpriced') delete policy.manualPriceTiers[key];
                        else policy.manualPriceTiers[key] = message.tier;
                    }
                } else {
                    const providerModels = inventoryModels.filter(item => item.vendor === message.vendor);
                    if (!providerModels.length) throw new Error('Provider is no longer available. Refresh the inventory.');
                    if (message.type === 'setProviderSelected') {
                        if (typeof message.selected !== 'boolean') throw new Error('Invalid selection.');
                        policy.selections = { ...policy.selections };
                        for (const model of providerModels) policy.selections[modelKey(model)] = message.selected;
                    } else {
                        if (!['cloud', 'local', 'unknown'].includes(message.kind)) throw new Error('Invalid provider type.');
                        if (isCopilotCloudVendor(message.vendor)) throw new Error('Copilot providers are always cloud.');
                        policy.selections = { ...policy.selections };
                        policy.classifications = { ...policy.classifications };
                        for (const model of providerModels) {
                            const key = modelKey(model);
                            policy.selections[key] = isModelSelected(model, policy.localModelVendors, policy.classifications, policy.selections, policy.providerTypes);
                            delete policy.classifications[key];
                        }
                        policy.providerTypes = { ...policy.providerTypes, [message.vendor]: message.kind };
                    }
                }
                if (['setModelSelected', 'setProviderSelected', 'setProviderType'].includes(message.type) && !hasSelectedLocalModel(inventoryModels, policy)) {
                    policy.scope = 'cloud';
                }
                await context.globalState.update(INVENTORY_STORAGE_KEY, { scope: policy.scope, priority: policy.priority, classifications: policy.classifications, providerTypes: policy.providerTypes, selections: policy.selections, localTiers: policy.localTiers, manualPriceTiers: policy.manualPriceTiers });
                if (refreshPromise) await refreshPromise;
                for (const refreshDashboard of dashboardRefreshers) void refreshDashboard();
            }).catch(error => {
                panel.webview.postMessage({ type: 'learningDashboardError', error: error instanceof Error ? error.message : String(error) });
            });
        }
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
            <fieldset class="scope-controls" id="model-scope"><legend>Model scope</legend><label><input type="radio" name="model-scope" value="cloud"> Cloud only</label><label><input type="radio" name="model-scope" value="local" disabled> Local only</label><label><input type="radio" name="model-scope" value="both" disabled> Both</label><label for="model-priority">Priority <select id="model-priority" disabled><option value="cloud-first">Cloud first</option><option value="local-first">Local first</option></select></label></fieldset>
            <div class="table-wrap"><table><thead><tr><th>Role</th><th>Task</th><th>Recommended model</th><th>Price tier</th><th>Selection mode</th><th>Outcomes</th><th>Observed quality</th><th>Price source</th></tr></thead><tbody id="recommendations"></tbody></table></div>
            <details id="model-inventory" open>
                <summary>Model inventory <span id="model-count">0 models</span></summary>
                <div class="inventory-content"><div class="inventory-toolbar"><label class="inventory-search">Search models <input id="model-search" type="search" placeholder="Name or provider"></label><div id="provider-controls" class="provider-controls"></div></div><details class="provider-settings"><summary>Provider types</summary><div id="provider-types" class="provider-types"></div></details><div class="table-wrap"><table><thead><tr><th>Use</th><th>Model</th><th>Provider / family</th><th>Tier</th><th>Price / 1M tokens</th><th>Source</th></tr></thead><tbody id="models"></tbody></table></div></div>
            </details>
        </section>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function deactivate() { }

module.exports = { activate, deactivate };