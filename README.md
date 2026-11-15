# Utopik Agent Council for Copilot Chat

An extension that contributes the Utopik agent roster to VS Code Copilot Chat and provides a local, animated roster view.

## Use

Install the extension in VS Code 1.146 or later and open Copilot Chat. Select **Maestro** (the Orchestrator role) for council routing; the other 48 council agents remain hidden from the picker and available for delegation. The **Agent Council** panel lists all 49 council agents.

For local development, run `npm install`, `npm test`, then press F5 to launch an Extension Development Host. Run `npm run package` to create a local VSIX; this repository does not publish it.

The extension contributes the on-demand `change-validation` skill to Copilot
Chat. It helps coding agents select and report repository-configured checks
without assuming a language or running the full suite by default. Contributors
working on this extension can use the more specific local
`extension-validation` skill under `.github/skills/`.

## What the council view shows

The view is a searchable pixel-office board with an original character and workstation for each of the 49 contributed agents. Characters animate on dispatch states explicitly reported by Maestro through a local extension tool. These reports are not independent observation of Copilot runtime activity. See [API capabilities and agent adaptations](docs/compatibility.md).

## Privacy

The roster and activity-reporting features make no network requests. The
activity tool records only agent names, lifecycle states, and generated run IDs
in extension-host memory; it never records prompts, results, file paths, or
source code. Copilot and any tools configured in the user's environment remain
subject to their own service, account, and privacy settings.