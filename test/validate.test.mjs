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

async function fixture(context) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'agent-roster-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    for (const folder of ['agents', 'skills/sample', 'docs']) {
        await mkdir(path.join(directory, folder), { recursive: true });
    }
    const manifest = {
        contributes: {
            chatAgents: [{ path: './agents/Orchestrator.agent.md' }, { path: './agents/ExampleAdvisor.agent.md' }],
            chatSkills: [{ path: './skills/sample/SKILL.md' }]
        }
    };
    await writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest));
    await writeFile(path.join(directory, 'docs/extraction-map.json'), '[]');
    await writeFile(path.join(directory, 'agents/Orchestrator.agent.md'), '---\nname: Orchestrator\ndescription: Dispatch\ntools: [agent]\nagents: [ExampleAdvisor]\n---\nRoute to ExampleAdvisor.\n');
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
    await writeFile(path.join(directory, 'agents/Orchestrator.agent.md'), '---\nname: Orchestrator\ndescription: Dispatch\ntools: [agent]\nagents: []\n---\nExampleAdvisor.\n');
    await assert.rejects(validate(directory), /allowlist/);
});

test('rejects references to skills missing from the extraction registry', async context => {
    const directory = await fixture(context);
    await writeFile(path.join(directory, 'docs/extraction-map.json'), '[{"skill":"missing","agents":["ExampleAdvisor"],"sections":[]}]');
    await assert.rejects(validate(directory), /Unregistered extracted skill/);
});

test('benchmarking is explicit-only and package has no runtime entry point', async () => {
    const skill = await readFile(path.join(root, 'skills/agent-model-benchmark/SKILL.md'), 'utf8');
    assert.equal(parseCustomization(skill, 'benchmark').metadata['disable-model-invocation'], true);
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(manifest.main, undefined);
    assert.equal(manifest.browser, undefined);
    assert.equal(manifest.enabledApiProposals, undefined);
    assert.equal(manifest.dependencies, undefined);
});