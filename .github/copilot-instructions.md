# Copilot Instructions

## Repository Purpose

This repository packages a curated agent roster and reusable workflow skills as a portable VS Code extension for GitHub Copilot Chat. Its main product is the Markdown instructions in `agents/` and `skills/`, registered through `package.json`; it is not a runtime agent framework and should not gain activation code or automatic access to a user's prompt profile.

Agent definitions are the runtime source of truth for role, tools, routing and task behavior. Skills hold reusable procedures shared by multiple agents. The roster originated as user-level prompts, but the packaged extension must remain self-contained and generic. Never require runtime access to a personal prompt folder or include personal paths, identities, or source-project details.

## Aro's Role

Aro is the orchestrator, not a worker. For every specialist dispatch, Aro must first consult the relevant tool-free domain advisor to select a worker, even when the route appears obvious. For a composite request, consult the relevant advisor for each distinct specialist selection. Use the advisor and worker candidates listed in Aro's embedded routing index; do not infer permission to dispatch from a skill, an advisor's ownership metadata, or a worker's definition.

Advisors return a selection only. Aro validates the recommendation against the supplied candidates and its `agents` allowlist, then invokes the worker itself and reconciles the result. Advisors and workers never delegate. Preserve approval, tool, and read-only boundaries. An advisor `NO_MATCH` is not authorization to bypass advisor selection; correct the candidate scope and consult the appropriate advisor, or ask for clarification if no valid route is established.

Keep Aro's route index compact and synchronized with advisor selection cues. Do not copy full worker procedures into Aro. Route live web research through the relevant advisor to `GovWebResearchAgent` before reporting a dispatcher tool limitation.

## Model Policy

Preserve intentional `model` frontmatter preferences. They are ordered defaults, not task-aware routing. Aro chooses a model per worker call when the runtime exposes an exact supported model ID: use the economical tier for clear, bounded, low-risk work and a higher-reasoning tier only when task complexity warrants it. Otherwise use configured preferences or the runtime default and report limitations. Do not pin every worker to a model or claim quality, latency, context, or cost benefits without measured evidence. Keep model benchmarking explicit and separate from normal dispatch. High-consequence decisions still require competent human validation.

## Skills And Agent Changes

Before adding or materially changing an agent, reevaluate `skills/` for procedures that should be shared. Put genuinely common workflows in a skill and link that skill from every applicable agent; keep role identity, tool boundaries, routing cues, and agent-specific behavior in the agent definition. Skills never grant tools or authorization. Avoid duplicating a shared procedure across agents when a linked skill is appropriate.

For an agent change, check and update all affected surfaces:

- Agent name, filename, YAML metadata, tool restrictions, and intentional model preference.
- Aro's allowlist and routing index, plus the relevant advisor's selection cues.
- Existing skills, their agent links, registrations in `package.json`, and `docs/extraction-map.json` when consumers or extracted procedures change.
- `docs/agents.md`, README or maintenance documentation, and focused regression tests.

Do not create a new agent for a one-off task or duplicate a skill without a clear ownership reason. Preserve the single-dispatcher architecture, tool-free advisors, and non-delegating workers.

## Validation

Use the repository's existing conventions and keep changes scoped. Run `npm test` and `npm run lint`; run `npm run vscode:prepublish` for the combined gate. If packaging behavior or contributed assets change, also run `npm run package` and inspect the resulting package as appropriate. Report checks that could not be run; static tests do not establish live model resolution or remote runtime availability.
