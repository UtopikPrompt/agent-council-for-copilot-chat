import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument, stringify } from 'yaml';
import { parseCustomization, root } from './validate.mjs';

const source = process.argv[2];
assert.ok(source, 'Usage: node scripts/import-customizations.mjs <source-prompts-directory>');
assert.notEqual(path.resolve(source), path.resolve(root), 'Import source must be outside the extension');

const workflows = [
    {
        name: 'release-contract-preflight',
        description: 'Verify release artifacts, provenance, overlays, storage ownership, rollback and stage-specific authorization. Use before release preparation, publication, infrastructure planning or rollout.',
        headings: ['Release Contract Preflight'],
        canonical: 'InfraReleaseManager',
        notes: 'For IaC, distinguish planning from apply and do not claim a plan proves absence of drift. For rollout, verify namespace and retained volume ownership, bounded waits, dependency sequencing, each workload state and rollback prerequisites. Never treat storage retention as backup or adoption permission.'
    },
    {
        name: 'identity-failure-isolation',
        description: 'Diagnose CI authentication and authorization failures using sanitized identity, OIDC, GitHub App, tenant and Secret-reference evidence. Use before proposing credential, permission or application changes.',
        headings: ['Identity Failure Isolation'],
        canonical: 'InfraCIDiagnostics',
        notes: 'Diagnosis is read-only unless a specific repair is authorized. Do not widen trust, roles, repository access or tenant scope, rotate secrets, regenerate tokens or reauthenticate automatically. Distinguish invalid identity from valid identity lacking access.'
    },
    {
        name: 'secure-development-bootstrap',
        description: 'Inspect and validate development environment setup across local hosts, SSH, containers and Codespaces. Use for setup hooks, profile configuration, secret delivery or polyglot environment bootstrapping.',
        headings: ['Secure Development Bootstrap'],
        canonical: 'InfraDevContainerSpecialist',
        notes: 'Preserve the repository\'s existing environment and polyglot conventions; do not introduce a new .polyglot directory or global tooling by default. Local validation does not establish remote or other-shell correctness.'
    },
    {
        name: 'frontend-experience-quality',
        description: 'Apply responsive layout, design-system consistency and functional interaction checks. Use while implementing or reviewing Next.js, React, Vite or other product interfaces.',
        headings: ['Frontend Experience Quality'],
        canonical: 'CodeNextJsSpecialist',
        notes: 'Check the actual rendered interface at narrow and wide viewports when browser tools are available. Exercise controls, loading, empty and error states and report visual checks that were not run. Use the existing styling and component stack.'
    },
    {
        name: 'markdown-mermaid-delivery',
        description: 'Produce native Markdown and readable Mermaid diagrams with honest rendering status. Use when writing documentation, ADRs, reports, issues or technical diagrams.',
        headings: ['Markdown Formatting', 'Mermaid Diagrams'],
        canonical: 'GovDocumentationSuiteGenerator',
        notes: 'A documentation role without execution permission must report renderer validation as not run rather than acquire additional tools. Formatting and diagram checks do not authorize GitHub writes or implementation.'
    },
    {
        name: 'go-contract-validation',
        description: 'Validate Go interfaces, provider adapters and lifecycle behavior using repository tooling. Use for Go contract changes involving cancellation, deadlines, idempotency, cleanup or error propagation.',
        headings: ['Go Contract Validation'],
        canonical: 'CodeGeneralist',
        notes: 'Do not contact real providers in unit tests. Integration, race and provider checks require supported tooling and task authorization. Follow the actual module minimum and toolchain rather than assuming a Go version.'
    },
    {
        name: 'container-display-operations',
        description: 'Investigate containerized display scheduling and host/device boundaries. Use for display power, Compose schedules, timezones, overnight intervals, restart behavior or device-access failures.',
        headings: ['Container Display Operations'],
        canonical: 'CodeGeneralist',
        notes: 'A skill cannot authorize host access, deployment or device changes. Preserve existing mounts, data, schedules and the ability to restore state. Route Kubernetes or firmware work back to the dispatcher.'
    },
    {
        name: 'specification-handoff',
        description: 'Turn approved specifications into a portable implementation handoff with requirements, acceptance criteria, evidence and decision status. Use when exporting a specification or preparing a code-generation kickoff.',
        headings: ['Specification To Code Handoff'],
        canonical: 'GovDocumentationSuiteGenerator',
        notes: 'Keep proposals separate from approved decisions. Preserve full requirement and acceptance content rather than replacing it with a status summary. Historical provenance gaps do not automatically block independent implementation; identify the specific parity question needing evidence.'
    },
    {
        name: 'progressive-investigation',
        description: 'Investigate a code or configuration problem from a concrete anchor using a falsifiable hypothesis and the cheapest discriminating check. Use for scoped debugging, implementation, review and diagnosis.',
        headings: ['Efficiency — Progressive Deepening'],
        canonical: 'InfraReleaseManager',
        notes: 'Review and diagnosis remain read-only. For authorized code changes, validate the smallest change immediately, then run relevant tests and configured lint on the final result. Do not expand tool permissions or read the whole repository simply to gain confidence.'
    }
];

function sections(body) {
    const found = new Map();
    const matches = [...body.matchAll(/^## (.+)\r?$/gm)];
    for (const [index, match] of matches.entries()) {
        found.set(match[1], { start: match.index, end: matches[index + 1]?.index ?? body.length });
    }
    return found;
}

function portableProcedure(text) {
    return text
        .replace(/; do not load external skills or client-profile workflow files/g, '')
        .replace(/ or load external skills\/client-profile workflow files/g, '')
        .replace(/ Do not load external skills or client-profile workflow files\./g, '')
        .replace(/ This procedure is self-contained\./g, '')
        .replace(/This procedure is embedded; /g, '')
        .replace(/This procedure is self-contained; /g, '');
}

const originals = new Map();
for (const filename of (await readdir(source)).filter(filename => filename.endsWith('.agent.md')).sort()) {
    const text = (await readFile(path.join(source, filename), 'utf8')).replace(/\r\n/g, '\n');
    const { metadata, body } = parseCustomization(text, filename);
    originals.set(metadata.name, { filename, text, body });
}

const extraction = [];
for (const workflow of workflows) {
    const original = originals.get(workflow.canonical);
    assert.ok(original, `Missing canonical agent: ${workflow.canonical}`);
    const indexed = sections(original.body);
    const procedures = workflow.headings.map(heading => {
        const section = indexed.get(heading);
        assert.ok(section, `${workflow.canonical}: missing ${heading}`);
        return portableProcedure(original.body.slice(section.start, section.end).trim());
    });
    const directory = path.join(root, 'skills', workflow.name);
    await mkdir(directory, { recursive: true });
    const title = workflow.name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
    const content = `---\n${stringify({ name: workflow.name, description: workflow.description }).trim()}\n---\n\n# ${title}\n\nUse only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.\n\n${procedures.join('\n\n')}\n\n## Role Boundaries\n\n${workflow.notes}\n`;
    await writeFile(path.join(directory, 'SKILL.md'), content, { flag: 'wx' });
    extraction.push({ skill: workflow.name, source: workflow.canonical, sections: workflow.headings, agents: [] });
}

await mkdir(path.join(root, 'agents'), { recursive: true });
for (const [name, original] of originals) {
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(original.text);
    const document = parseDocument(frontmatter[1]);
    let body = original.body;
    const indexed = sections(body);
    const replacements = [];
    for (const [index, workflow] of workflows.entries()) {
        const matches = workflow.headings.filter(heading => indexed.has(heading));
        if (!matches.length) continue;
        extraction[index].agents.push(name);
        for (const [headingIndex, heading] of matches.entries()) {
            const section = indexed.get(heading);
            const replacement = headingIndex === 0
                ? `## ${workflow.name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')}\n\nWhen this workflow is relevant, read and follow the bundled [${workflow.name} skill](../skills/${workflow.name}/SKILL.md) before acting.\n\n`
                : '';
            replacements.push({ ...section, replacement });
        }
    }
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
        body = body.slice(0, replacement.start) + replacement.replacement + body.slice(replacement.end);
    }
    if (replacements.length) {
        body = `${body.trim()}\n\n## Skill Loading\n\nSkill links are package-relative, not target-workspace-relative. Use the runtime-discovered location or verified procedure content supplied by Aro; never guess paths or search personal profiles. Keep tool and approval boundaries. If unavailable, return the skill name and failed lookup to Aro; do not invent procedures or block independent authorized work.\n`;
    }
    await writeFile(path.join(root, 'agents', original.filename), `---\n${document.toString().trim()}\n---\n\n${body.trim()}\n`, { flag: 'wx' });
}

const benchmarkDirectory = path.join(root, 'skills', 'agent-model-benchmark');
await mkdir(benchmarkDirectory, { recursive: true });
const benchmark = await readFile(path.join(source, '.agents', 'skills', 'agent-model-benchmark', 'SKILL.md'), 'utf8');
await writeFile(path.join(benchmarkDirectory, 'SKILL.md'), benchmark.replace(/^user-invocable: true\r?$/m, 'user-invocable: true\ndisable-model-invocation: true'), { flag: 'wx' });

const manifestPath = path.join(root, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.contributes.chatAgents = [...originals.values()].map(original => ({ path: `./agents/${original.filename}` }));
manifest.contributes.chatSkills = [...workflows.map(workflow => workflow.name), 'agent-model-benchmark'].sort().map(name => ({ path: `./skills/${name}/SKILL.md` }));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs', 'extraction-map.json'), `${JSON.stringify(extraction, null, 2)}\n`, { flag: 'wx' });
const catalog = [
    '# Agent Catalog',
    '',
    'Orchestrator is the dispatcher. Advisors select a worker without tools; workers do not delegate. Agent names and role boundaries are preserved from the source council.',
    '',
    '| Agent | Purpose |',
    '| --- | --- |',
    ...[...originals].map(([name, original]) => {
        const { metadata } = parseCustomization(original.text, original.filename);
        return `| [${name}](../agents/${original.filename}) | ${metadata.description.replace(/\s+/g, ' ').replace(/\|/g, '\\|')} |`;
    }),
    ''
].join('\n');
await writeFile(path.join(root, 'docs', 'agents.md'), catalog, { flag: 'wx' });
console.log(`Imported ${originals.size} agents; extracted ${workflows.length} workflows and retained the model benchmark skill.`);