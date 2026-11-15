---
name: extension-validation
description: Select proportionate validation for changes to this VS Code extension. Use when deciding which project checks to run after an implementation change or when preparing a VSIX.
---

# VS Code extension validation

Choose checks from the change's actual scope; do not run the full sequence by
default.

- For TypeScript, roster, activity-store, or webview changes, run `npm test`.
  This compiles the project and runs the focused roster tests.
- For extension activation, contributed tools, chat-agent registration, or VS
  Code API behavior, also run `npm run test:host`.
- Run `npm run package` when changing packaging inputs, contributed manifest
  entries, or when a VSIX is requested. Packaging compiles again and includes
  the SDK runtime, so it is slower and produces a large artifact.
- There is no configured lint script. Do not invent or report a lint check.
- Do not install dependencies unless a manifest changed or validation reports
  a missing dependency.
Report the exact checks run and distinguish compile, extension-host, packaging,
and live model validation.
