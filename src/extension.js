const vscode = require('vscode');
const { randomBytes } = require('node:crypto');
const { effectiveModelScope, getInventorySummary, getManagedPricing, hasSelectedLocalModel, isCopilotCloudVendor, isModelSelected, modelKey, modelKind, selectModels } = require('./model-pricing');
const {
    ACTIVITIES,
    compactModelRecommendations,
    DOMAINS,
    excludeUnavailableModels,
    getContextualLearningDashboard,
    getModelRecommendations,
    normalizeScorecard,
    recordOutcome,
    TASK_CATEGORIES
} = require('./model-learning');
const { ADVISOR_PINNED_MODEL_KEY, getAdvisorFilteredModels, getAdvisorPinnedModel } = require('./advisor-pinning');

const LEARNING_STORAGE_KEY = 'agentRoster.modelLearning.scorecard.v1';
const INVENTORY_STORAGE_KEY = 'agentRoster.modelLearning.inventory.v1';
const MANUAL_SELECTIONS_KEY = 'agentRoster.modelLearning.manualSelections.v1';
const dashboardRefreshers = new Set();
let inventoryUpdates = Promise.resolve();

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

function saveInventoryPolicy(context, policy) {
    return context.globalState.update(INVENTORY_STORAGE_KEY, {
        scope: policy.scope, priority: policy.priority, classifications: policy.classifications,
        providerTypes: policy.providerTypes, selections: policy.selections,
        localTiers: policy.localTiers, manualPriceTiers: policy.manualPriceTiers
    });
}

function getManualSelections(context) {
    const stored = context.globalState.get(MANUAL_SELECTIONS_KEY);
    return Array.isArray(stored) ? stored.map(selection => selection?.domain === 'github-workflow'
        ? { ...selection, domain: 'documentation-governance' }
        : selection).filter(selection => selection
        && ACTIVITIES.includes(selection.activity)
        && DOMAINS.includes(selection.domain)
        && TASK_CATEGORIES.includes(selection.difficulty)
        && typeof selection.modelId === 'string'
        && selection.modelId.length > 0
        && typeof selection.vendor === 'string'
        && selection.vendor.length > 0) : [];
}

function getManualSelection(selections, context) {
    return selections.find(selection => selection.activity === context.activity
        && selection.domain === context.domain
        && selection.difficulty === context.difficulty) || null;
}

function enqueueInventoryUpdate(update) {
    const result = inventoryUpdates.then(update);
    inventoryUpdates = result.catch(() => {});
    return result;
}

function refreshLearningViews() {
    for (const refresh of dashboardRefreshers) void refresh();
}

const ADVISOR_PIN_DIFFICULTIES = ['simple', 'standard', 'complex'];

// Validates a pin against current availability, scope, selection, exclusions and every task difficulty before storing it.
async function applyAdvisorPinnedModel(context, pin, exclusions = {}) {
    if (pin === null) {
        await context.globalState.update(ADVISOR_PINNED_MODEL_KEY, null);
        return;
    }
    if (!pin || typeof pin !== 'object' || typeof pin.modelId !== 'string' || !pin.modelId || typeof pin.vendor !== 'string' || !pin.vendor) {
        throw new Error('Invalid advisor model.');
    }
    const models = await selectChatModelsWithTimeout();
    const policy = getInventoryPolicy(context);
    const scope = effectiveModelScope(models, policy);
    if (!models.some(model => model.id === pin.modelId && model.vendor === pin.vendor)) {
        throw new Error('Advisor model is not currently available. Refresh the inventory.');
    }
    const eligibleForEveryDifficulty = ADVISOR_PIN_DIFFICULTIES.every(difficulty => {
        const eligible = selectModels(models, policy.localModelVendors, policy.classifications, scope, { ...policy, taskCategory: difficulty });
        return excludeUnavailableModels(eligible, exclusions).some(model => model.id === pin.modelId && model.vendor === pin.vendor);
    });
    if (!eligibleForEveryDifficulty) {
        throw new Error('Advisor model is not eligible for the current scope, selection, exclusions, and every task difficulty.');
    }
    await context.globalState.update(ADVISOR_PINNED_MODEL_KEY, { modelId: pin.modelId, vendor: pin.vendor });
}

async function pinAdvisorModel(context) {
    try {
        const models = await selectChatModelsWithTimeout();
        const choices = models.map(model => ({
            label: `${model.name} (${model.vendor})`,
            value: { modelId: model.id, vendor: model.vendor }
        }));
        choices.push({ label: 'Use learned recommendation (no pin)', value: null });
        const choice = await vscode.window.showQuickPick(choices, {
            title: 'Pin advisor model',
            placeHolder: 'Select a model for advisor recommendations or clear the pin'
        });
        if (!choice) return;
        await enqueueInventoryUpdate(async () => {
            await applyAdvisorPinnedModel(context, choice.value);
            refreshLearningViews();
        });
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not pin advisor model: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function createLearningSidebar(context) {
    const changes = new vscode.EventEmitter();
    const refresh = () => changes.fire();
    dashboardRefreshers.add(refresh);
    const item = (label, description, icon, command, tooltip) => {
        const row = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        row.description = description;
        row.iconPath = new vscode.ThemeIcon(icon);
        if (tooltip) row.tooltip = tooltip;
        if (command) row.command = { command, title: label };
        return row;
    };
    const openDashboard = 'agentRoster.openModelLearning';
    return {
        onDidChangeTreeData: changes.event,
        async getChildren(element) {
            if (element) return [];
            const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
            const rows = [item('Open Aro Learning', '', 'dashboard', openDashboard)];
            let models;
            try {
                models = await selectChatModelsWithTimeout();
            } catch (error) {
                rows.push(item('Models unavailable', '', 'warning', openDashboard, error instanceof Error ? error.message : String(error)));
                rows.push(item('Outcomes', String(scorecard.records.length), 'graph', openDashboard));
                return rows;
            }
            const policy = getInventoryPolicy(context);
            const summary = getInventorySummary(models, policy);
            const scopeLabel = { cloud: 'Cloud only', local: 'Local only', both: 'Both' }[summary.scope];
            rows.push(item('Scope', scopeLabel, 'settings-gear', 'agentRoster.changeModelScope'));
            rows.push(item('Priority', summary.scope === 'both' ? policy.priority === 'local-first' ? 'Local first' : 'Cloud first' : 'Not applicable', 'arrow-swap', summary.scope === 'both' ? 'agentRoster.changeModelPriority' : undefined));
            const pinned = getAdvisorPinnedModel(context);
            rows.push(item('Advisor model', pinned ? pinned.modelId : 'Learned recommendation', 'pin', 'agentRoster.pinAdvisorModel'));
            rows.push(item('Selected models', `${summary.cloudCount} cloud / ${summary.localCount} local`, 'checklist', openDashboard));
            if (summary.unknownCount) rows.push(item('Unclassified selected', String(summary.unknownCount), 'warning', openDashboard));
            rows.push(item('Unrated local', String(summary.unratedLocalCount), summary.unratedLocalCount ? 'warning' : 'check', openDashboard));
            rows.push(item('Outcomes', String(scorecard.records.length), 'graph', openDashboard));
            const last = scorecard.records.at(-1);
            if (last) {
                const difficulty = last.difficulty || last.taskCategory;
                const context = last.activity ? {
                    activity: last.activity,
                    domain: last.domain,
                    difficulty
                } : { role: last.role, taskCategory: difficulty };
                const eligible = selectModels(models, policy.localModelVendors, policy.classifications, summary.scope, { ...policy, taskCategory: difficulty });
                const result = getModelRecommendations(scorecard, {
                    ...context, models: eligible,
                    getPricing: model => getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes, policy.manualPriceTiers),
                    getModelKind: model => modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes),
                    preference: summary.scope === 'both' ? policy.priority === 'local-first' ? 'local' : 'cloud' : undefined
                });
                const recommended = result.candidates.find(candidate => candidate.id === result.recommendedModelId);
                const fallback = difficulty === 'complex' && result.candidates.some(candidate => Number.isFinite(candidate.cost))
                    ? 'No learned recommendation' : 'No eligible model';
                const contextLabel = last.activity
                    ? `${last.activity} / ${last.domain} / ${difficulty}`
                    : `${last.role} / ${difficulty}`;
                rows.push(item(`Latest context: ${contextLabel}`, recommended ? `${recommended.name} (${recommended.vendor})` : fallback, 'lightbulb', openDashboard, 'Current recommendation for the most recently recorded outcome; not proof of the model used.'));
            } else {
                rows.push(item('Latest context', 'No recorded outcomes', 'lightbulb', openDashboard));
            }
            return rows;
        },
        getTreeItem(row) { return row; },
        dispose() { dashboardRefreshers.delete(refresh); changes.dispose(); }
    };
}

async function changeModelScope(context) {
    try {
        const models = await selectChatModelsWithTimeout();
        const policy = getInventoryPolicy(context);
        const choices = [{ label: 'Cloud only', value: 'cloud' }];
        if (hasSelectedLocalModel(models, policy)) choices.push({ label: 'Local only', value: 'local' }, { label: 'Both', value: 'both' });
        const choice = await vscode.window.showQuickPick(choices, { title: 'Model scope', placeHolder: 'Choose which models Aro may recommend' });
        if (!choice) return;
        await enqueueInventoryUpdate(async () => {
            const currentPolicy = getInventoryPolicy(context);
            const currentModels = await selectChatModelsWithTimeout();
            if (choice.value !== 'cloud' && !hasSelectedLocalModel(currentModels, currentPolicy)) throw new Error('Select a local model before using this scope.');
            currentPolicy.scope = choice.value;
            await saveInventoryPolicy(context, currentPolicy);
            refreshLearningViews();
        });
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not change model scope: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function changeModelPriority(context) {
    try {
        const choice = await vscode.window.showQuickPick([
            { label: 'Cloud first', value: 'cloud-first' },
            { label: 'Local first', value: 'local-first' }
        ], { title: 'Model priority' });
        if (!choice) return;
        await enqueueInventoryUpdate(async () => {
            const policy = getInventoryPolicy(context);
            const models = await selectChatModelsWithTimeout();
            if (effectiveModelScope(models, policy) !== 'both') throw new Error('Priority is available only when both scopes are selected.');
            policy.priority = choice.value;
            await saveInventoryPolicy(context, policy);
            refreshLearningViews();
        });
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not change model priority: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function activate(context) {
    context.subscriptions.push(registerModelLearningTools(context));
    context.subscriptions.push(vscode.commands.registerCommand('agentRoster.openModelLearning', () => openModelLearning(context)));
    context.subscriptions.push(vscode.commands.registerCommand('agentRoster.changeModelScope', () => changeModelScope(context)));
    context.subscriptions.push(vscode.commands.registerCommand('agentRoster.changeModelPriority', () => changeModelPriority(context)));
    context.subscriptions.push(vscode.commands.registerCommand('agentRoster.pinAdvisorModel', () => pinAdvisorModel(context)));
    const sidebar = createLearningSidebar(context);
    context.subscriptions.push(sidebar, vscode.window.registerTreeDataProvider('agentRoster.modelLearning', sidebar));
    if (typeof vscode.lm.onDidChangeChatModels === 'function') context.subscriptions.push(vscode.lm.onDidChangeChatModels(refreshLearningViews));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('agentRoster.modelLearning.localModelVendors')) refreshLearningViews();
    }));
}

function registerModelLearningTools(context) {
    const readTool = vscode.lm.registerTool('aroGetModelRecommendations', {
        prepareInvocation({ input }) {
            return { invocationMessage: `Reading learned model outcomes for ${input.activity} / ${input.domain} / ${input.difficulty}` };
        },
        async invoke({ input }) {
            const policy = getInventoryPolicy(context);
            const availableModels = await vscode.lm.selectChatModels();
            const scope = effectiveModelScope(availableModels, policy);
            const eligibleModels = selectModels(availableModels, policy.localModelVendors, policy.classifications, scope, { ...policy, taskCategory: input.difficulty });
            const manualSelection = getManualSelection(getManualSelections(context), input);
            const models = getAdvisorFilteredModels(context, excludeUnavailableModels(eligibleModels, { excludedModels: input.excludedModels, excludedProviders: input.excludedProviders }), policy, input, manualSelection);
            const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
            const recommendations = getModelRecommendations(scorecard, {
                ...input,
                manualSelection,
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
            const callId = randomBytes(16).toString('hex');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ ...compactModelRecommendations(recommendations), callId, modelScope: scope, modelPriority: scope === 'both' ? policy.priority : null }))
            ]);
        }
    });

    const recordTool = vscode.lm.registerTool('aroRecordModelOutcome', {
        prepareInvocation({ input }) {
            return { invocationMessage: `Recording verified ${input.outcome} for ${input.activity} / ${input.domain} / ${input.difficulty}` };
        },
        async invoke({ input }) {
            const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
            const next = recordOutcome(scorecard, input);
            await context.globalState.update(LEARNING_STORAGE_KEY, next);
            const matching = next.records.filter(record => record.activity === input.activity
                && record.domain === input.domain
                && record.difficulty === input.difficulty
                && record.modelId === input.modelId);
            const successes = matching.filter(record => record.outcome === 'success').length;
            const failures = matching.length - successes;
            refreshLearningViews();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({
                    stored: true,
                    modelId: input.modelId,
                    callId: input.callId,
                    activity: input.activity,
                    domain: input.domain,
                    difficulty: input.difficulty,
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
    let refreshRequested = false;
    let inventoryModels = [];
    const refresh = async () => {
        if (refreshPromise) {
            refreshRequested = true;
            return refreshPromise;
        }
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
            const getPricing = model => getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes, policy.manualPriceTiers);
            const manualSelections = getManualSelections(context);
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
                    pricing: getPricing(model)
                })),
                providerTypes: Object.fromEntries([...new Set(summaries.map(model => model.vendor))].map(vendor => [vendor, isCopilotCloudVendor(vendor) ? 'cloud' : policy.providerTypes[vendor] || (policy.localModelVendors.includes(vendor) ? 'local' : 'unknown')])),
                lockedProviders: [...new Set(summaries.map(model => model.vendor).filter(isCopilotCloudVendor))],
                dashboard: getContextualLearningDashboard(scorecard, summaries, getPricing, {
                    getModelsForTask: difficulty => selectModels(summaries, policy.localModelVendors, policy.classifications, scope, { ...policy, taskCategory: difficulty }),
                    getManualSelection: context => getManualSelection(manualSelections, context),
                    getModelKind: model => modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes),
                    preference: scope === 'both' ? policy.priority === 'local-first' ? 'local' : 'cloud' : undefined
                }),
                pinnedAdvisorModel: getAdvisorPinnedModel(context),
                recordCount: scorecard.records.length
            });
        })().catch(error => {
            panel.webview.postMessage({ type: 'learningDashboardError', error: error instanceof Error ? error.message : String(error) });
        }).finally(() => {
            refreshPromise = undefined;
            if (refreshRequested) {
                refreshRequested = false;
                void refresh();
            }
        });
        return refreshPromise;
    };

    dashboardRefreshers.add(refresh);
    panel.webview.onDidReceiveMessage(message => {
        if (message.type === 'ready' || message.type === 'refreshLearning') void refresh();
        if (message.type === 'setAdvisorPinnedModel') {
            void enqueueInventoryUpdate(async () => {
                await applyAdvisorPinnedModel(context, message.model, {
                    excludedModels: message.excludedModels,
                    excludedProviders: message.excludedProviders
                });
                if (refreshPromise) await refreshPromise;
                refreshLearningViews();
            }).catch(error => {
                panel.webview.postMessage({ type: 'learningDashboardError', error: error instanceof Error ? error.message : String(error) });
            });
            return;
        }
        if (['chooseManualModel', 'useLearnedModel'].includes(message.type)) {
            void enqueueInventoryUpdate(async () => {
                const learningContext = {
                    activity: message.activity,
                    domain: message.domain,
                    difficulty: message.difficulty
                };
                if (!ACTIVITIES.includes(learningContext.activity) || !DOMAINS.includes(learningContext.domain)
                    || !TASK_CATEGORIES.includes(learningContext.difficulty)) throw new Error('Invalid recommendation context.');
                const selections = getManualSelections(context).filter(selection => !(
                    selection.activity === learningContext.activity
                    && selection.domain === learningContext.domain
                    && selection.difficulty === learningContext.difficulty));
                if (message.type === 'chooseManualModel') {
                    const policy = getInventoryPolicy(context);
                    const scope = effectiveModelScope(inventoryModels, policy);
                    const eligibleModels = selectModels(inventoryModels, policy.localModelVendors, policy.classifications, scope, {
                        ...policy,
                        taskCategory: learningContext.difficulty
                    });
                    const scorecard = normalizeScorecard(context.globalState.get(LEARNING_STORAGE_KEY));
                    const recommendations = getModelRecommendations(scorecard, {
                        ...learningContext,
                        models: eligibleModels,
                        getPricing: model => getManagedPricing(model, policy.localModelVendors, policy.classifications, policy.providerTypes, policy.manualPriceTiers),
                        getModelKind: model => modelKind(model, policy.localModelVendors, policy.classifications, policy.providerTypes),
                        preference: scope === 'both' ? policy.priority === 'local-first' ? 'local' : 'cloud' : undefined
                    });
                    const choices = recommendations.candidates.filter(candidate => Number.isFinite(candidate.cost)).map(candidate => ({
                        label: candidate.name,
                        description: candidate.vendor,
                        detail: `${candidate.pricing.budgetClass}; ${candidate.samples} exact / ${candidate.pooledSamples} pooled outcomes`,
                        modelId: candidate.id,
                        vendor: candidate.vendor
                    }));
                    if (!choices.length) throw new Error('No eligible priced models are available for this context and scope.');
                    const choice = await vscode.window.showQuickPick(choices, {
                        title: `Manual model: ${learningContext.activity} / ${learningContext.domain} / ${learningContext.difficulty}`,
                        placeHolder: 'Choose a model for this context'
                    });
                    if (!choice) {
                        refreshLearningViews();
                        return;
                    }
                    selections.push({ ...learningContext, modelId: choice.modelId, vendor: choice.vendor });
                }
                await context.globalState.update(MANUAL_SELECTIONS_KEY, selections);
                if (refreshPromise) await refreshPromise;
                refreshLearningViews();
            }).catch(error => {
                panel.webview.postMessage({ type: 'learningDashboardError', error: error instanceof Error ? error.message : String(error) });
            });
            return;
        }
        if (['setModelScope', 'setModelPriority', 'setModelSelected', 'setProviderSelected', 'setProviderType', 'setLocalTier', 'setManualPriceTier'].includes(message.type)) {
            void enqueueInventoryUpdate(async () => {
                const policy = getInventoryPolicy(context);
                const hadSelectedLocalModel = hasSelectedLocalModel(inventoryModels, policy);
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
                if (['setModelSelected', 'setProviderSelected', 'setProviderType'].includes(message.type) && hadSelectedLocalModel && !hasSelectedLocalModel(inventoryModels, policy)) {
                    policy.scope = 'cloud';
                }
                await saveInventoryPolicy(context, policy);
                if (refreshPromise) await refreshPromise;
                refreshLearningViews();
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
                <p>Recommendations learn from verified outcomes for each activity, domain, and difficulty.</p>
  </header>
        <p class="notice">Aro stores context labels, the requested model ID, verified outcome code, and optional measured duration or cost. It stores no prompts or responses. Tool and environment failures are not model failures; runtime model resolution is not independently verified.</p>
  <main>
            <div id="learning-status" class="model-load-status is-loading" role="status" aria-live="polite" aria-busy="true">
                <span id="learning-message">Loading Aro's scorecard...</span>
            </div>
            <div class="page-tabs" id="view-tabs" role="tablist" aria-label="Aro learning views">
                <button id="view-tab-recommendations" type="button" role="tab" aria-selected="true" aria-controls="recommendations-view" data-view="recommendations">Recommendations</button>
                <button id="view-tab-inventory" type="button" role="tab" aria-selected="false" aria-controls="inventory-view" data-view="inventory" tabindex="-1">Model inventory <span id="model-count">0 models</span></button>
            </div>
        <section id="recommendations-view" class="view-panel" role="tabpanel" aria-labelledby="view-tab-recommendations">
            <div class="toolbar"><h2>Learned recommendations</h2><div class="advisor-default"><label for="advisor-default-model">Aro &amp; advisors default</label><select id="advisor-default-model"></select></div><button id="refresh-learning" type="button">Refresh</button></div>
            <fieldset class="scope-controls" id="model-scope"><legend>Model scope</legend><label><input type="radio" name="model-scope" value="cloud"> Cloud only</label><label><input type="radio" name="model-scope" value="local" disabled> Local only</label><label><input type="radio" name="model-scope" value="both" disabled> Both</label><label for="model-priority">Priority <select id="model-priority" disabled><option value="cloud-first">Cloud first</option><option value="local-first">Local first</option></select></label></fieldset>
            <fieldset class="context-controls" id="learning-context"><legend>Filter recommendation table</legend><div class="activity-filter"><span id="domain-filter-label">Domain</span><div id="domain-tabs" class="activity-tabs" role="tablist" aria-labelledby="domain-filter-label"></div></div><div class="activity-filter"><span id="activity-filter-label">Activity</span><div id="activity-tabs" class="activity-tabs" role="tablist" aria-labelledby="activity-filter-label"></div></div></fieldset>
            <p id="context-count" class="context-count" aria-live="polite"></p>
            <div class="table-wrap" id="recommendations-panel" role="tabpanel" aria-labelledby="activity-tab-all" tabindex="0"><table><thead><tr><th id="context-activity-heading">Activity</th><th id="context-domain-heading">Domain</th><th id="context-difficulty-heading">Difficulty</th><th>Recommended model</th><th>Evidence</th><th>Price</th></tr></thead><tbody id="recommendations"></tbody></table></div>
        </section>
        <section id="inventory-view" class="view-panel" role="tabpanel" aria-labelledby="view-tab-inventory" hidden>
            <div class="toolbar"><h2>Model inventory</h2><span id="model-count-label">0 models</span></div>
            <div class="inventory-content"><label class="inventory-search">Search models <input id="model-search" type="search" placeholder="Name or provider"></label><h3>Providers</h3><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Model selection</th><th>Type</th></tr></thead><tbody id="providers"></tbody></table></div><h3>Models</h3><div class="table-wrap"><table><thead><tr><th>Use</th><th>Model</th><th>Provider / family</th><th>Tier</th><th>Price / 1M tokens</th><th>Source</th></tr></thead><tbody id="models"></tbody></table></div></div>
        </section>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function deactivate() { }

module.exports = { activate, deactivate };