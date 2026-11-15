# Copilot Compatibility and Activity Limits

Verified against the official VS Code documentation on 2026-11-14. The latest stable release was VS Code 1.146.0 (2026-11-11); the extension declares that version as its minimum.

## Stable extension surface

VS Code supports the stable `contributes.chatAgents` extension contribution. Each entry points to a `.agent.md` file inside the extension. These definitions appear in Copilot Chat's custom-agent discovery and can be selected as chat agents. The extension also contributes a normal webview view through the stable `views` and `WebviewViewProvider` APIs.

The VS Code extension API does not expose lifecycle events for native Copilot chat sessions or contributed/custom-agent executions. In particular, an extension cannot independently observe a user's selected agent, agent progress, tool calls, subagent start/end events, or runtime parent-child identifiers. The subagent documentation describes activity in VS Code's own chat UI; it does not define a public extension event API for that activity.

This extension contributes a stable language-model tool that Orchestrator may call before and after its own agent-tool invocations. The council view displays only those explicit reports as `Dispatching`, `Returned`, or `Failed`; it does not infer a live Copilot state. Reports contain only a canonical agent name, a lifecycle status, and an extension-generated run ID. They are held in memory for the extension host lifetime and are not independently verified. If Orchestrator omits or fails to send a report, the view can be incomplete.

VS Code's proposed `chatParticipantAdditions` API includes `ChatSubagentToolInvocationData`, which can render subagent-style progress inside a chat participant's own response. It is not a subscription to native Copilot subagent events, is not a stable API for Marketplace extensions, and the Chat Participant API is deprecated and unsupported in the Copilot harness. This extension does not depend on it.

The older `vscode.chat.createChatParticipant` API handles requests sent to that participant only. It is deprecated and is not supported in the Copilot harness, so it is not used as a monitor or as a substitute chat entry point here. The Orchestrator definition itself is contributed through `chatAgents`.

## Agent adaptations

All 49 source `.agent.md` files are included. Their Markdown instruction bodies and `tools` lists were preserved. The following frontmatter changes are specific to Copilot compatibility:

| Source field | Adaptation | Effect |
|---|---|---|
| `name` | The Orchestrator definition is displayed as `Maestro`; its filename, embedded role, and routing references remain `Orchestrator`. | Gives the user-invocable dispatcher a product-facing name without changing worker identifiers. |
| `argument-hint` | Removed from all files. | The field is not supported by the Copilot custom-agent schema. |
| `agents` | Removed from all files. The Orchestrator's embedded routing index and worker allowlist remain in its body. | Copilot uses its native `task` delegation tool; the Local `agents` allowlist is not a Copilot enforcement boundary. The embedded allowlist is model guidance, not a hard runtime restriction. |
| `model` | Preserved for the seven source agents that declare it. | The Copilot model catalog lists GPT-6 Luna and Claude Haiku 5.5 for VS Code. These are preferences, not guarantees: plan entitlements and organization policy may affect availability, and users can select another model. |

Qualified tool references such as `github/*`, `io.github.ihor-sokoliuk/mcp-searxng/*`, `vscode/askQuestions`, and `read/readFile` are retained. They work only when the corresponding tools are provided by the user's Copilot session. This extension does not install or configure those tools. Missing tools can limit an agent's behavior; prompt text cannot create a tool or enforce permissions.

Only Maestro, the Orchestrator role, is user-invocable in this extension. The source definitions also set GovGitWorkflowAgent and GovWebResearchAgent to `user-invocable: true`; those two flags are adapted to `false` here to keep them available for delegation without exposing them as direct picker entries. Their tool constraints and instruction bodies are unchanged.

## Privacy

The extension does not collect or transmit telemetry, prompts, source code, or chat history. It makes no network requests. Its activity tool stores only reported lifecycle metadata in memory, without prompts, results, file paths, or source content. The tool input and acknowledgement are part of the active Copilot conversation flow; Copilot and any user-configured tools have their own data handling and service behavior.

## Official references

- [VS Code 1.146 release notes](https://code.visualstudio.com/updates/v1_146)
- [Extension contribution point: `contributes.chatAgents`](https://code.visualstudio.com/api/references/contribution-points#contributeschatagents)
- [Custom agent file reference](https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference)
- [Use subagents in VS Code](https://code.visualstudio.com/docs/agents/run/subagents)
- [VS Code API: chat namespace](https://code.visualstudio.com/api/references/vscode-api#chat)
- [Chat participant API deprecation](https://code.visualstudio.com/api/extension-guides/ai/chat)
- [Proposed API policy](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)