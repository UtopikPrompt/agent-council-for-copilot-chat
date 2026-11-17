import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { parseCustomization, resolveAsset, root, validate } from '../scripts/validate.mjs';

test('parses YAML metadata and retains the procedure', () => {
    const result = parseCustomization('---\nname: sample\ndescription: "Use when: testing"\n---\n# Procedure\n', 'sample');
    assert.equal(result.metadata.name, 'sample');
    assert.equal(result.body, '# Procedure\n');
});

test('rejects missing metadata and duplicate YAML keys', () => {
    for (const text of ['# No metadata', '---\nname: sample\n---\nBody', '---\nname: sample\nname: duplicate\ndescription: test\n---\nBody']) {
        assert.throws(() => parseCustomization(text, 'invalid'));
    }
});

test('resolves portable assets without permitting package traversal', () => {
    const base = path.resolve('fixture');
    assert.equal(resolveAsset(base, './agents/Example.agent.md'), path.join(base, 'agents', 'Example.agent.md'));
    for (const target of ['../outside.md', '.', 'agents\\Example.agent.md', path.resolve('outside.md')]) {
        assert.throws(() => resolveAsset(base, target));
    }
});

test('validates the complete council and all extracted workflow consumers', async () => {
    assert.deepEqual(await validate(), { agents: 49, skills: 10 });
});

test('Aro learns model outcomes by role and task using evidence-gated tools', async () => {
    const { metadata, body } = parseCustomization(await readFile(path.join(root, 'agents/Aro.agent.md'), 'utf8'), 'Aro');
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const extensionId = `${manifest.publisher}.${manifest.name}`;
    assert.deepEqual(metadata.model, ['GPT-6 Luna', 'Claude Haiku 5.5']);
    assert.ok(metadata.tools.includes(`${extensionId}/aroGetModelRecommendations`));
    assert.ok(metadata.tools.includes(`${extensionId}/aroRecordModelOutcome`));
    const modelSelection = body.split('## Model Selection and Learning\n')[1]?.split(/^## /m)[0];
    assert.ok(modelSelection, 'Missing model selection guidance');
    assert.match(modelSelection, /aroGetModelRecommendations/);
    assert.match(modelSelection, /selectionMode/);
    assert.match(modelSelection, /use `recommendedModelId`\s+to find its candidate/);
    assert.match(modelSelection, /exact `modelArgument` when\s+supported/);
    assert.match(modelSelection, /`learned` or an eligible `explore`/);
    assert.match(modelSelection, /never bypass the selected model scope/);
    assert.match(modelSelection, /aroRecordModelOutcome/);
    assert.match(modelSelection, /Do not\s+score routing mistakes,\s+missing input,\s+unsupported models, tool failures/);
    assert.ok(modelSelection.includes('Claude Haiku 5.5 (copilot)'));
    assert.ok(modelSelection.includes('clear, bounded'));
    assert.ok(modelSelection.includes('low-risk'));
    assert.ok(modelSelection.includes('Claude Sonnet 5.5 (copilot)'));
    assert.ok(modelSelection.includes('materially complex'));
});

test('preserves economical model preferences on configured selection advisors', async () => {
    const advisors = ['CodeBackendAdvisor', 'CodeDomainAdvisor', 'CodeFrontendAdvisor', 'DocsGovernanceAdvisor', 'InfraDevOpsAdvisor', 'UtilityAdvisor'];
    for (const name of advisors) {
        const { metadata } = parseCustomization(await readFile(path.join(root, `agents/${name}.agent.md`), 'utf8'), name);
        assert.equal(metadata.model, 'Claude Haiku 5.5', `${name}: expected economical advisor model preference`);
    }
});

test('Aro resolves procedure gaps and owns persistence for read-only assessment workers', async () => {
    const { body } = parseCustomization(await readFile(path.join(root, 'agents/Aro.agent.md'), 'utf8'), 'Aro');
    assert.match(body, /runtime-discovered locations, never paths guessed from\s+the target repository/);
    assert.match(body, /retry the affected scope/);
    assert.match(body, /continuing independent authorized work/);
    assert.match(body, /consult DocsGovernanceAdvisor and invoke GovDocumentationSuiteGenerator/);
    assert.match(body, /verify saved paths by read-back/);
    assert.match(body, /only after the writer route fails or lacks its required tools/);
    const worker = parseCustomization(await readFile(path.join(root, 'agents/CodeRebuildEngineer.agent.md'), 'utf8'), 'CodeRebuildEngineer');
    assert.deepEqual(worker.metadata.tools, ['read', 'search']);
    assert.deepEqual(worker.metadata.agents, []);
    assert.match(worker.body, /Return complete findings, artifact content and\s+proposed paths to Aro/);
    assert.match(worker.body, /Missing edit tools do not block read-only analysis/);
    assert.match(worker.body, /return its skill name and failed lookup to Aro/);
});

async function fixture(context) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'agent-roster-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    for (const folder of ['agents', 'skills/sample', 'docs']) {
        await mkdir(path.join(directory, folder), { recursive: true });
    }
    const manifest = {
        contributes: {
            chatAgents: [{ path: './agents/Aro.agent.md' }, { path: './agents/ExampleAdvisor.agent.md' }],
            chatSkills: [{ path: './skills/sample/SKILL.md' }]
        }
    };
    await writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest));
    await writeFile(path.join(directory, 'docs/extraction-map.json'), '[]');
    await writeFile(path.join(directory, 'agents/Aro.agent.md'), '---\nname: Aro\ndescription: Dispatch\ntools: [agent]\nagents: [ExampleAdvisor]\n---\nRoute to ExampleAdvisor.\n');
    await writeFile(path.join(directory, 'agents/ExampleAdvisor.agent.md'), '---\nname: ExampleAdvisor\ndescription: Select\ntools: []\n---\nChoose a worker.\n');
    await writeFile(path.join(directory, 'skills/sample/SKILL.md'), '---\nname: sample\ndescription: Use for tests\n---\nRun a test.\n');
    return directory;
}

test('accepts a complete minimal extension fixture', async context => {
    assert.deepEqual(await validate(await fixture(context)), { agents: 2, skills: 1 });
});

test('rejects broken bundled skill links', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'agents/ExampleAdvisor.agent.md'), '---\nname: ExampleAdvisor\ndescription: Select\ntools: []\n---\nRead [missing](../skills/missing/SKILL.md).\n');
    await assert.rejects(validate(directory), /ENOENT/);
});

test('requires agent-level discovery and recovery guidance for extracted skills', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'docs/extraction-map.json'), JSON.stringify([
        { skill: 'sample', agents: ['Aro'], sections: [] }
    ]));
    const filename = path.join(directory, 'agents/Aro.agent.md');
    const original = await readFile(filename, 'utf8');
    const reference = 'Read [sample](../skills/sample/SKILL.md).';
    const guidance = [
        'The link is package-relative, not target-workspace-relative.',
        'Load by skill name from the runtime-discovered location.',
        'If unavailable, return the skill name and failed lookup to Aro.'
    ];
    for (const [index, error] of [
        /ambiguous skill path base/,
        /missing skill discovery guidance/,
        /missing procedure recovery handoff/
    ].entries()) {
        await writeFile(filename, `${original}\n${reference}\n\n## Skill Loading\n${guidance.filter((sentence, position) => position !== index).join(' ')}\n`);
        await assert.rejects(validate(directory), error);
    }
    await writeFile(filename, `${original}\n${reference}\n\n## Skill Loading\n${guidance.join(' ')}\n`);
    assert.deepEqual(await validate(directory), { agents: 2, skills: 1 });
    await writeFile(filename, `${original}\n${reference}\n\n## Skill Loading\n${guidance.join(' ')}\n\n## Skill Loading\nRepeated policy.\n`);
    await assert.rejects(validate(directory), /exactly one skill-loading policy/);
});

test('rejects role tool escalation', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'agents/ExampleAdvisor.agent.md'), '---\nname: ExampleAdvisor\ndescription: Select\ntools: [execute]\n---\nChoose a worker.\n');
    await assert.rejects(validate(directory), /tool-free/);
});

test('rejects unregistered customizations', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'agents/Hidden.agent.md'), '---\nname: Hidden\ndescription: Hidden\ntools: []\n---\nHidden.\n');
    await assert.rejects(validate(directory), /Unregistered customization/);
});

test('rejects skill directory and frontmatter name mismatches', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'skills/sample/SKILL.md'), '---\nname: mismatch\ndescription: Use for tests\n---\nRun a test.\n');
    await assert.rejects(validate(directory), /mismatch/);
});

test('rejects a stale dispatcher allowlist', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'agents/Aro.agent.md'), '---\nname: Aro\ndescription: Dispatch\ntools: [agent]\nagents: []\n---\nExampleAdvisor.\n');
    await assert.rejects(validate(directory), /allowlist/);
});

test('rejects references to skills missing from the extraction registry', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'docs/extraction-map.json'), '[{"skill":"missing","agents":["ExampleAdvisor"],"sections":[]}]');
    await assert.rejects(validate(directory), /Unregistered extracted skill/);
});

test('Aro model learning is automatic, persistent, and has no manual benchmark UI', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(manifest.main, './src/extension.js');
    assert.ok(manifest.activationEvents.includes('onCommand:agentRoster.openModelLearning'));
    assert.ok(manifest.activationEvents.includes('onView:agentRoster.modelLearning'));
    assert.ok(manifest.contributes.commands.some(command => command.command === 'agentRoster.openModelLearning'));
    assert.ok(manifest.contributes.viewsContainers.activitybar.some(container => container.id === 'agentRoster' && container.icon === 'assets/aro-wireframe.svg'));
    assert.ok(manifest.contributes.views.agentRoster.some(view => view.id === 'agentRoster.modelLearning' && view.type === undefined));
    for (const name of ['aroGetModelRecommendations', 'aroRecordModelOutcome']) {
        const tool = manifest.contributes.languageModelTools.find(entry => entry.name === name);
        assert.ok(tool);
        assert.equal(tool.canBeReferencedInPrompt, true);
        assert.equal(tool.toolReferenceName, name);
    }
    const aro = await readFile(path.join(root, 'agents/Aro.agent.md'), 'utf8');
    const extensionId = `${manifest.publisher}.${manifest.name}`;
    for (const name of ['aroGetModelRecommendations', 'aroRecordModelOutcome']) {
        assert.ok(aro.includes(`${extensionId}/${name}`));
    }
    assert.equal(manifest.browser, undefined);
    assert.equal(manifest.enabledApiProposals, undefined);
    assert.equal(manifest.dependencies, undefined);
    const extension = await readFile(path.join(root, 'src/extension.js'), 'utf8');
    assert.match(extension, /registerTreeDataProvider\('agentRoster\.modelLearning'/);
    assert.doesNotMatch(extension, /registerWebviewViewProvider\('agentRoster\.modelLearning'/);
    assert.match(extension, /vscode\.lm\.registerTool\('aroGetModelRecommendations'/);
    assert.match(extension, /vscode\.lm\.registerTool\('aroRecordModelOutcome'/);
    assert.match(extension, /context\.globalState\.update\(LEARNING_STORAGE_KEY/);
    assert.match(extension, /getLearningDashboard/);
    assert.equal((extension.match(/img-src \$\{webview\.cspSource\}/g) || []).length, 1);
    assert.doesNotMatch(extension, /message\.type === 'benchmark'/);
    assert.doesNotMatch(extension, /model\.sendRequest/);
    assert.match(extension, /getManagedPricing\(model, policy\.localModelVendors, policy\.classifications, policy\.providerTypes, policy\.manualPriceTiers\)/);
    assert.match(extension, /selectModels\(availableModels, policy\.localModelVendors, policy\.classifications, scope/);
    assert.match(extension, /getModelsForTask: taskCategory => selectModels\(summaries/);
    assert.deepEqual(manifest.contributes.configuration.properties['agentRoster.modelLearning.localModelVendors'].default, []);
    const handlerRegistration = extension.indexOf('panel.webview.onDidReceiveMessage(message =>', extension.indexOf('function openModelLearning'));
    const htmlAssignment = extension.indexOf('panel.webview.html = getLearningHtml', extension.indexOf('function openModelLearning'));
    assert.ok(handlerRegistration >= 0 && handlerRegistration < htmlAssignment);
    assert.match(extension, /selectChatModelsWithTimeout/);
    assert.match(extension, /MODEL_DISCOVERY_TIMEOUT_MS = 15_000/);
    assert.match(extension, /id="model-count"/);
    const dashboard = await readFile(path.join(root, 'media/model-learning-dashboard.js'), 'utf8');
    assert.match(dashboard, /refreshLearning/);
    assert.match(dashboard, /vscode\.postMessage\(\{ type: 'ready' \}\)/);
    assert.match(dashboard, /recommendedModelId/);
    assert.doesNotMatch(dashboard, /toggle-inventory/);
    assert.doesNotMatch(dashboard, /sendRequest|benchmark|textarea|scorecard.*set/i);
});

test('Aro consults the required domain advisor before every specialist dispatch', async () => {
    const { body } = parseCustomization(await readFile(path.join(root, 'agents/Aro.agent.md'), 'utf8'), 'Aro');
    assert.match(body, /Before every specialist dispatch, invoke the relevant advisor/);
    assert.match(body, /consult\s+the relevant advisor for each distinct specialist selection/);
    assert.match(body, /\| Selection Cue \| Worker \| Required Advisor \|/);
    assert.doesNotMatch(body, /Optional Advisor/);
});

test('Aro surfaces evidence-based roster gaps without automatic filing', async () => {
    const { body } = parseCustomization(await readFile(path.join(root, 'agents/Aro.agent.md'), 'utf8'), 'Aro');
    assert.match(body, /## Roster Gap Signals/);
    assert.match(body, /current-conversation evidence/);
    assert.match(body, /Never create an agent, skill, issue, or project automatically/);
    assert.match(body, /consult DocsGovernanceAdvisor and dispatch GovGithubAgent/);
    assert.match(body, /if filing tools or a verified destination\s+are unavailable, provide the draft/);
});

test('inventory changes persist and affect dashboard and recommendation tool', async () => {
    const tools = new Map();
    const commands = new Map();
    const state = new Map();
    state.set('agentRoster.modelLearning.inventory.v1', {
        scope: 'local-first',
        providerTypes: { copilotcli: 'local' },
        classifications: { '["copilotcli","cli"]': 'local' },
        selections: { '["copilotcli","cli"]': false }
    });
    const models = [
        { id: 'cloud', name: 'Cloud', vendor: 'copilot', inputCost: 10, outputCost: 50 },
        { id: 'unpriced', name: 'Unpriced model', vendor: 'copilot' },
        { id: 'cli', name: 'CLI', vendor: 'copilotcli', inputCost: 20, outputCost: 100 },
        { id: 'local', name: 'Local', vendor: 'ollama' }
    ];
    let panel;
    const vscode = {
        lm: {
            registerTool: (name, tool) => { tools.set(name, tool); return { dispose() {} }; },
            selectChatModels: async () => models
        },
        workspace: { getConfiguration: () => ({ get: () => [] }) },
        commands: { registerCommand: (name, callback) => { commands.set(name, callback); return { dispose() {} }; } },
        window: {
            registerTreeDataProvider: () => ({ dispose() {} }),
            createWebviewPanel: () => {
                panel = {
                    webview: {
                        cspSource: 'test',
                        asWebviewUri: uri => uri,
                        onDidReceiveMessage: handler => { panel.receive = handler; },
                        postMessage: message => { if (['learningDashboard', 'learningDashboardError'].includes(message.type)) panel.resolve(message); }
                    },
                    onDidDispose() {}
                };
                return panel;
            }
        },
        Uri: { joinPath: (...parts) => parts.join('/') },
        ViewColumn: { One: 1 },
        LanguageModelTextPart: class { constructor(value) { this.value = value; } },
        LanguageModelToolResult: class { constructor(content) { this.content = content; } }
    };
    const localRequire = createRequire(path.join(root, 'src/extension.js'));
    const module = { exports: {} };
    const source = await readFile(path.join(root, 'src/extension.js'), 'utf8');
    vm.runInNewContext(source, {
        module, exports: module.exports,
        require: name => name === 'vscode' ? vscode : localRequire(name),
        setTimeout, clearTimeout
    });
    const context = {
        subscriptions: [], extensionUri: 'extension',
        globalState: { get: key => state.get(key), update: async (key, value) => { state.set(key, value); } }
    };
    module.exports.activate(context);
    commands.get('agentRoster.openModelLearning')();
    const nextDashboard = () => new Promise(resolve => { panel.resolve = resolve; });
    let response = nextDashboard();
    panel.receive({ type: 'ready' });
    let dashboard = await response;
    assert.equal(dashboard.scope, 'cloud');
    assert.equal(dashboard.hasSelectedLocalModel, false);
    assert.equal(dashboard.priority, 'local-first');
    assert.equal(dashboard.models.find(model => model.id === 'local').kind, 'unknown');
    assert.equal(dashboard.models.find(model => model.id === 'cli').kind, 'cloud');
    assert.equal(dashboard.providerTypes.copilotcli, 'cloud');
    assert.ok(dashboard.lockedProviders.includes('copilot'));
    assert.ok(dashboard.lockedProviders.includes('copilotcli'));
    for (const vendor of ['copilot', 'copilotcli']) {
        response = nextDashboard();
        panel.receive({ type: 'setProviderType', vendor, kind: 'local' });
        const rejected = await response;
        assert.equal(rejected.type, 'learningDashboardError');
        assert.match(rejected.error, /always cloud/);
    }
    const initialResult = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'simple' } });
    assert.equal(JSON.parse(initialResult.content[0].value).modelScope, 'cloud');
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'both' });
    const unavailableScope = await response;
    assert.equal(unavailableScope.type, 'learningDashboardError');
    assert.match(unavailableScope.error, /Select a local model/);
    assert.equal(state.get('agentRoster.modelLearning.inventory.v1').scope, 'local-first');
    response = nextDashboard();
    panel.receive({ type: 'setProviderType', vendor: 'ollama', kind: 'local' });
    dashboard = await response;
    assert.equal(dashboard.models.find(model => model.id === 'local').kind, 'local');
    response = nextDashboard();
    panel.receive({ type: 'setModelSelected', id: 'local', vendor: 'ollama', selected: true });
    dashboard = await response;
    assert.equal(dashboard.models.find(model => model.id === 'local').selected, true);
    assert.equal(dashboard.hasSelectedLocalModel, true);
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'both' });
    dashboard = await response;
    assert.equal(dashboard.scope, 'both');
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'cloud');
    response = nextDashboard();
    panel.receive({ type: 'setLocalTier', id: 'local', vendor: 'ollama', tier: 'standard' });
    dashboard = await response;
    assert.equal(dashboard.models.find(model => model.id === 'local').localTier, 'standard');
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'local' });
    dashboard = await response;
    assert.equal(dashboard.scope, 'local');
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'local');
    const result = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'simple' } });
    const recommendation = JSON.parse(result.content[0].value);
    assert.equal(recommendation.modelScope, 'local');
    assert.equal(recommendation.modelPriority, null);
    assert.equal(recommendation.recommendedModelId, 'local');
    assert.deepEqual(recommendation.candidates.map(candidate => candidate.id), ['local']);
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'both' });
    await response;
    response = nextDashboard();
    panel.receive({ type: 'setModelPriority', priority: 'local-first' });
    dashboard = await response;
    assert.equal(dashboard.scope, 'both');
    assert.equal(dashboard.priority, 'local-first');
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'local');
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'complex').recommendedModelId, 'cloud');
    const complexResult = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'complex' } });
    assert.equal(JSON.parse(complexResult.content[0].value).modelPriority, 'local-first');
    assert.equal(JSON.parse(complexResult.content[0].value).recommendedModelId, 'cloud');
    const temporarilyUnavailable = models.pop();
    const unavailableResult = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'simple' } });
    assert.equal(JSON.parse(unavailableResult.content[0].value).modelScope, 'cloud');
    assert.equal(state.get('agentRoster.modelLearning.inventory.v1').scope, 'both');
    models.push(temporarilyUnavailable);
    response = nextDashboard();
    panel.receive({ type: 'setModelPriority', priority: 'cloud-first' });
    dashboard = await response;
    assert.equal(dashboard.priority, 'cloud-first');
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'cloud');
    const cloudResult = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'simple' } });
    assert.equal(JSON.parse(cloudResult.content[0].value).recommendedModelId, 'cloud');
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'local' });
    await response;
    response = nextDashboard();
    panel.receive({ type: 'setProviderSelected', vendor: 'ollama', selected: false });
    dashboard = await response;
    assert.equal(dashboard.models.find(model => model.id === 'local').selected, false);
    assert.equal(dashboard.scope, 'cloud');
    assert.equal(dashboard.hasSelectedLocalModel, false);
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'cloud');
    const afterRemoval = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'simple' } });
    assert.equal(JSON.parse(afterRemoval.content[0].value).modelScope, 'cloud');
    assert.equal(state.get('agentRoster.modelLearning.inventory.v1').scope, 'cloud');
    response = nextDashboard();
    panel.receive({ type: 'setProviderSelected', vendor: 'ollama', selected: true });
    await response;
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'local' });
    await response;
    commands.get('agentRoster.openModelLearning')();
    response = nextDashboard();
    panel.receive({ type: 'ready' });
    dashboard = await response;
    assert.equal(dashboard.scope, 'local');
    assert.equal(dashboard.priority, 'cloud-first');
    assert.equal(dashboard.models.find(model => model.id === 'local').localTier, 'standard');
    assert.equal(dashboard.models.find(model => model.id === 'local').selected, true);
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'both' });
    dashboard = await response;
    assert.equal(dashboard.priority, 'cloud-first');
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'cloud');
    response = nextDashboard();
    panel.receive({ type: 'setManualPriceTier', id: 'unpriced', vendor: 'copilot', tier: 'medium' });
    dashboard = await response;
    assert.equal(dashboard.models.find(model => model.id === 'unpriced').pricing.source, 'manual');
    response = nextDashboard();
    panel.receive({ type: 'setModelScope', scope: 'cloud' });
    await response;
    const manualResult = await tools.get('aroGetModelRecommendations').invoke({ input: { role: 'coding', taskCategory: 'simple' } });
    assert.equal(JSON.parse(manualResult.content[0].value).candidates.find(candidate => candidate.id === 'unpriced').pricing.budgetClass, 'medium');
    response = nextDashboard();
    panel.receive({ type: 'setModelSelected', id: 'cloud', vendor: 'copilot', selected: false });
    dashboard = await response;
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, 'unpriced');
    response = nextDashboard();
    panel.receive({ type: 'setManualPriceTier', id: 'unpriced', vendor: 'copilot', tier: 'unpriced' });
    dashboard = await response;
    assert.equal(dashboard.dashboard.find(row => row.role === 'coding' && row.taskCategory === 'simple').recommendedModelId, null);
});

test('inventory webview sends scope, selection, tier and provider changes', async () => {
    const elements = new Map();
    const messages = [];
    let receive;
    class Element {
        constructor() { this.children = []; this.listeners = {}; this.value = ''; }
        addEventListener(type, handler) { this.listeners[type] = handler; }
        setAttribute() {}
        append(...children) { this.children.push(...children); }
        replaceChildren() { this.children = []; }
    }
    for (const id of ['models', 'model-search', 'model-count', 'recommendations', 'learning-status', 'learning-message', 'refresh-learning', 'model-scope', 'model-priority', 'provider-controls', 'provider-types']) {
        elements.set(id, new Element());
    }
    const scopeControls = ['cloud', 'local', 'both'].map(value => Object.assign(new Element(), { name: 'model-scope', value }));
    const document = {
        getElementById: id => elements.get(id),
        createElement: () => new Element(),
        querySelectorAll: selector => selector.startsWith('#model-scope input') ? scopeControls : []
    };
    const source = await readFile(path.join(root, 'media/model-learning-dashboard.js'), 'utf8');
    vm.runInNewContext(source, {
        document,
        window: { addEventListener: (type, handler) => { if (type === 'message') receive = handler; } },
        acquireVsCodeApi: () => ({ postMessage: message => messages.push(JSON.parse(JSON.stringify(message))) })
    });
    assert.equal(messages[0].type, 'ready');
    receive({ data: { type: 'learningDashboard', models: [
        { id: 'm', name: 'Model', vendor: 'ollama', kind: 'local', selected: true, localTier: 'unrated', pricing: {} },
        { id: 'c', name: 'Cloud', vendor: 'copilot', kind: 'cloud', selected: true, pricing: { source: 'unpriced', budgetClass: 'unpriced' } },
        { id: 'cli', name: 'CLI', vendor: 'copilotcli', kind: 'cloud', selected: true, pricing: { source: 'vscode', budgetClass: 'high' } }
    ], providerTypes: { ollama: 'local', copilot: 'cloud', copilotcli: 'cloud' }, lockedProviders: ['copilot', 'copilotcli'], dashboard: [], recordCount: 0, scope: 'both', priority: 'cloud-first', hasSelectedLocalModel: true } });
    assert.equal(elements.get('model-priority').disabled, false);
    assert.equal(scopeControls[1].disabled, false);
    assert.equal(scopeControls[2].disabled, false);
    assert.equal(elements.get('model-priority').value, 'cloud-first');
    elements.get('model-priority').listeners.change({ target: { value: 'local-first' } });
    assert.deepEqual(messages.at(-1), { type: 'setModelPriority', priority: 'local-first' });
    const row = elements.get('models').children[0];
    const checkbox = row.children[0].children[0];
    checkbox.checked = false;
    checkbox.listeners.change();
    assert.deepEqual(messages.at(-1), { type: 'setModelSelected', id: 'm', vendor: 'ollama', selected: false });
    const select = row.children[3].children[0];
    assert.equal(select.children[3].textContent, 'High (complex)');
    select.value = 'standard';
    select.listeners.change();
    assert.deepEqual(messages.at(-1), { type: 'setLocalTier', id: 'm', vendor: 'ollama', tier: 'standard' });
    const provider = elements.get('provider-controls').children[2];
    provider.listeners.click();
    assert.deepEqual(messages.at(-1), { type: 'setProviderSelected', vendor: 'ollama', selected: false });
    const providerType = elements.get('provider-types').children[2].children[1];
    providerType.value = 'cloud';
    providerType.listeners.change();
    assert.deepEqual(messages.at(-1), { type: 'setProviderType', vendor: 'ollama', kind: 'cloud' });
    assert.equal(elements.get('provider-types').children[0].children[1].textContent, 'Cloud');
    assert.equal(elements.get('provider-types').children[1].children[1].textContent, 'Cloud');
    assert.equal(elements.get('models').children[2].children[3].textContent, 'high');
    const priceTier = elements.get('models').children[1].children[3].children[0];
    priceTier.value = 'medium';
    priceTier.listeners.change();
    assert.deepEqual(messages.at(-1), { type: 'setManualPriceTier', id: 'c', vendor: 'copilot', tier: 'medium' });
    elements.get('model-scope').listeners.change({ target: { name: 'model-scope', value: 'local' } });
    assert.deepEqual(messages.at(-1), { type: 'setModelScope', scope: 'local' });
    receive({ data: { type: 'learningDashboard', models: [], providerTypes: {}, lockedProviders: [], dashboard: [], recordCount: 0, scope: 'cloud', priority: 'local-first', hasSelectedLocalModel: false } });
    assert.equal(elements.get('model-priority').disabled, true);
    assert.equal(elements.get('model-priority').value, 'local-first');
    assert.equal(scopeControls[0].disabled, false);
    assert.equal(scopeControls[0].checked, true);
    assert.equal(scopeControls[1].disabled, true);
    assert.equal(scopeControls[2].disabled, true);
});