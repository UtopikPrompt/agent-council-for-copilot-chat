# Migration And Maintenance

## Content Selection

The initial migration reads the user-supplied prompt directory without modifying it. It retains all 49 agent definitions, their routing hierarchy and tool allowlists, and the existing model benchmark skill. Personal model frontmatter and dispatcher model-brand preferences are removed so the installed extension uses the user's runtime selection.

The package excludes source Git metadata, Python caches, generated reports, historical improvement notes and client-editor settings. The separately maintained Microsoft Foundry skill bundle is not vendored: its dependencies, service assumptions and redistribution terms need an independent review. Install it separately when required.

Useful roster descriptions become the [agent catalog](agents.md). Runtime routing remains embedded in Orchestrator rather than relying on that documentation.

## Extraction Decisions

The [extraction map](extraction-map.json) records the canonical source agent, original headings and every consuming agent for each of the nine extracted skills. The benchmark skill is retained separately, not counted as a new extraction. Shared procedures have one skill entry point; the relevant agent sections now link to that procedure and must load it before acting.

Authorization, existing-edit protection, current-contract policy, final test/lint obligations and role restrictions remain inline. These are baseline constraints, not optional task skills. Skill loading never overrides a role's narrower permissions. Tool-free advisors do not need to load skills.

The personal roster's former rule requiring every procedure to be embedded has intentionally changed for this extension: required shared workflows are packaged alongside the agents and registered through `chatSkills`. No runtime access to the original profile directory is required. If a bundled procedure is unavailable, the agent must report it as blocked rather than fabricate it.

The Git worker's embedded PR procedure no longer requires separately installed PR skills; available skills can enrich it. Existing direct invocation of that worker is preserved. Model benchmarking is explicitly manual-only and does not assume particular model brands.

## Source Layout

- `agents/`: packaged custom agent definitions.
- `skills/<name>/SKILL.md`: packaged, independently discoverable workflows.
- `docs/agents.md`: role catalog.
- `docs/extraction-map.json`: shared-workflow provenance and consumers.
- `scripts/validate.mjs` and `test/`: structural lint and regression tests; not shipped in the VSIX.
- `scripts/import-customizations.mjs`: initial bulk extraction utility, not a synchronization service. It requires an explicit source path and refuses to overwrite existing agents/skills. It was used for initial migration; subsequent portability fixes live in the checked-in assets. Do not rerun it over this maintained tree.

When changing a role, synchronize its name/file, manifest contribution, Orchestrator allowlist and routing cues, advisor selection cues, catalog and affected tests. When changing a shared workflow, edit its skill once and verify all consumers. Do not add blanket tool permissions or fixed user paths.

## Validation

Run `npm test` and `npm run lint`, then `npm run package`. Inspect package contents with `npx vsce ls` when changing exclusions. There is deliberately no runtime extension-host entry point or VS Code proposed API dependency.

Before distribution, test the actual VSIX in a clean VS Code profile with Copilot enabled:

1. Install the VSIX, reload if prompted, and open a fresh chat.
2. Verify Orchestrator and the Git worker in the agent picker. Verify all 49 definitions and 10 skills in Chat: Open Customizations, including hidden worker agents.
3. Give Orchestrator a small read-only task and verify it invokes the indexed worker rather than merely describing a delegation.
4. Invoke `/markdown-mermaid-delivery` with a small documentation request. Verify the skill content loads from the installed extension.
5. Give a frontend worker a scoped request through Orchestrator and verify the linked quality skill loads without a client-profile search.
6. Confirm the benchmark is not selected automatically and is available explicitly as `/agent-model-benchmark`.
7. Repeat discovery, delegation and skill loading in an intended SSH/container window. Check missing-tool reporting without broadening permissions.

Static tests and VSIX packaging do not prove live model behavior, remote discovery, authentication or MCP availability. Record those smoke results separately. The project uses the [PolyForm Noncommercial License 1.0.0](../LICENSE); commercial use requires separate permission. Verify rights to all included content and publisher ownership before Marketplace publication. Local packaging does not grant those rights or publish the extension.