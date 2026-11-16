import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
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
    assert.match(modelSelection, /for complex or high-consequence tasks, use the configured model or\s+fallback below/);
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
    assert.match(extension, /getModelPricing\(model\)/);
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