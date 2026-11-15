# Utopik Agent Council for Copilot Chat

An extension that contributes the Utopik agent roster to VS Code Copilot Chat and provides a local, animated roster view.

## Use

Install the extension in VS Code 1.146 or later, open Copilot Chat, and select **Orchestrator** from the agent picker. The other 48 agents are hidden from the picker and remain available for delegation. The **Agent Council** panel lists all 49 contributed definitions.

For local development, run `npm install`, `npm test`, then press F5 to launch an Extension Development Host. Run `npm run package` to create a local VSIX; this repository does not publish it.

## What the council view shows

The view is a searchable, animated catalog of the coordinator, seven advisors, and 41 specialist agents. Its motion is decorative. Stable VS Code extension APIs do not expose Copilot session or subagent lifecycle events to third-party extensions, so the view does not show active/idle state, execution progress, or observed parent-child relationships. See [API capabilities and agent adaptations](docs/compatibility.md).

## Privacy

The extension sends no prompts, source code, telemetry, or activity records to any service. It does not read chat history. Copilot and any tools configured in the user's environment remain subject to their own service, account, and privacy settings.