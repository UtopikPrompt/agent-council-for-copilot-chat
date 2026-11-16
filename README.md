# Agent Roster for Copilot Chat

A VS Code extension providing **49 specialized agents** and **10 reusable skills** for GitHub Copilot Chat. Select **Orchestrator**, describe the goal and target, and let it select the appropriate worker.

The extension contributes Markdown customizations directly through VS Code's `chatAgents` and `chatSkills` contribution points. It has no activation code, runtime dependencies, telemetry or automatic setup actions. It does not copy files into your repositories or personal prompt folder.

## Install

Requires VS Code **1.111 or newer**, a current GitHub Copilot Chat installation with agent support, and Copilot access. The extension does not include models, subscriptions, MCP servers or credentials.

Build locally with Node.js 22.12 or newer and npm:

```sh
npm ci
npm run package
```

Run **Extensions: Install from VSIX...** and select `agent-roster-for-copilot-chat-0.1.0.vsix`, then start a fresh chat. Alternatively:

```sh
code --install-extension agent-roster-for-copilot-chat-0.1.0.vsix
```

No Marketplace publication is needed for local installation. The publisher field is package metadata, not proof of a registered or authenticated Marketplace publisher.

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, modification and redistribution are permitted under its terms. Commercial use requires separate permission from the rights holder. The license expressly permits specified charitable, educational, research, public-service and government uses; see the full terms for scope.

This is a source-available license, not an open-source license. Third-party dependencies retain their own licenses.

## Use The Roster

Select **Orchestrator** in the agent picker and provide a short request, for example:

```text
Fix the failing request-validation test in src/api; preserve the current stack.
```

Orchestrator is the only dispatcher. Its seven tool-free advisors resolve ambiguous selection; the 41 workers own implementation, diagnosis, business knowledge, architecture, infrastructure, governance and supporting tasks. Workers do not delegate. Most workers are hidden from the picker but remain available as subagents. The source Git workflow agent remains directly selectable.

Keep the goal, target and desired output concise. The selected worker owns its procedures. Reviews and diagnosis do not authorize repairs, and release preparation does not authorize publication or rollout. Agents use your selected/default model rather than pinned personal model names.

See the [complete agent catalog](docs/agents.md) for all roles.

## Skills

Type `/` in chat to select a skill, or describe a matching task so Copilot can load it. Discovery does not guarantee selection; agent definitions explicitly link required shared workflows.

| Skill | Reusable Procedure |
| --- | --- |
| [progressive-investigation](skills/progressive-investigation/SKILL.md) | Concrete anchor, hypothesis, cheapest check and scoped validation |
| [release-contract-preflight](skills/release-contract-preflight/SKILL.md) | Artifact identity, provenance, overlays, storage, rollback and stage gates |
| [identity-failure-isolation](skills/identity-failure-isolation/SKILL.md) | OIDC, GitHub Apps, permissions, tenant mapping and Secret references |
| [secure-development-bootstrap](skills/secure-development-bootstrap/SKILL.md) | Safe host, SSH, container and polyglot environment setup |
| [frontend-experience-quality](skills/frontend-experience-quality/SKILL.md) | Responsive, functional interfaces consistent with the existing design system |
| [go-contract-validation](skills/go-contract-validation/SKILL.md) | Go interfaces, provider boundaries, lifecycle, cancellation and cleanup |
| [container-display-operations](skills/container-display-operations/SKILL.md) | Display scheduling, timezones and host/device permission boundaries |
| [specification-handoff](skills/specification-handoff/SKILL.md) | Approved requirements, acceptance criteria, evidence and implementation kickoff |
| [markdown-mermaid-delivery](skills/markdown-mermaid-delivery/SKILL.md) | Native Markdown, readable diagrams and explicit rendering status |
| [agent-model-benchmark](skills/agent-model-benchmark/SKILL.md) | Explicitly requested, paired read-only model trials with verified telemetry |

Benchmarking is manual-only (`/agent-model-benchmark`), since it invokes extra model trials and may incur usage. Skills cannot expand an agent's tools or the user's authorization.

## Availability And Migration

- Your existing personal customizations remain untouched. If names collide, use **Chat: Open Customizations** to inspect their source and disable an unwanted copy yourself. This extension never deletes or renames personal files.
- GitHub workers need authenticated GitHub tooling or the documented GitHub CLI path. The web research worker needs the configured SearXNG MCP tools. Browser, cloud, container and other domain tools must be available in the active session; missing tools are reported rather than installed automatically.
- For Remote SSH or containers, ensure this extension is enabled in the target VS Code window. Check both Agents and Skills in **Chat: Open Customizations** and verify a linked skill can be read in a fresh chat. No personal-directory junctions or workflow searches are required. Live remote discovery and tool access still require a smoke test in that environment.
- Agents and skills are instructions, not a security sandbox. Review tool approvals and the content before use. Do not grant blanket permissions to make a task proceed.

## Development

```sh
npm test
npm run lint
npm run package
```

Packaging runs tests and customization lint automatically. The lint checks YAML, registration, relative links, names, skill metadata, dispatcher membership, tool-free advisors, nondelegating workers and the extraction map.

See [migration and maintenance](docs/maintenance.md) for provenance, extraction decisions and installation smoke checks. The editable source of truth is now `agents/` and `skills/`, not the original personal folder.