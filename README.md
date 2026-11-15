# Utopik Agent Council for Copilot Chat

An extension that contributes the Utopik agent roster to VS Code Copilot Chat and provides a local, animated roster view.

## Use

Install the extension in VS Code 1.146 or later, open Copilot Chat, and select **Maestro** (the Orchestrator role) from the agent picker. The other 48 agents are hidden from the picker and remain available for delegation. The **Agent Council** panel lists all 49 contributed definitions.

For local development, run `npm install`, `npm test`, then press F5 to launch an Extension Development Host. Run `npm run package` to create a local VSIX; this repository does not publish it.

## What the council view shows

The view is a searchable catalog of the coordinator, seven advisors, and 41 specialist agents. It animates dispatch and return states explicitly reported by Orchestrator through a local extension tool. These reports are not independent observation of Copilot runtime activity. See [API capabilities and agent adaptations](docs/compatibility.md).

## Privacy

The extension makes no network requests and sends no telemetry. The activity tool records only agent names, lifecycle states, and generated run IDs in extension-host memory; it never records prompts, results, file paths, or source code. Copilot and any tools configured in the user's environment remain subject to their own service, account, and privacy settings.