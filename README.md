# Aro: Agent Roster Orchestrator for Copilot Chat

**Tell Copilot what you need. Aro finds the right specialist.**

<p align="center">
	<img src="assets/image_885ba20f.jpg" alt="Aro, a robot character surrounded by connected specialist nodes" width="640">
</p>

This extension adds 49 focused helpers to GitHub Copilot Chat. They can help explain a project, solve coding problems, plan changes, improve documentation, and more. Aro is the starting point: describe your task in your own words, and it brings in a helper suited to the work.

## Get Started

Open Copilot Chat, choose **Aro** agent, and describe what you need. For example:

```text
I’m new to this project. Explain what it does and where I should start.
```

You can ask Aro to make a plan before changing anything. Review suggestions and approve changes through the usual Copilot prompts.

## Agents

The roster includes 49 specialists. Start with Aro: describe what you need, and Aro selects a relevant specialist.

<details>
<summary>Browse all 49 agents</summary>

| Agent | Purpose |
| --- | --- |
| [AgentOptimizer](agents/AgentOptimizer.agent.md) | Analyze and optimize VS Code agents, including tools, triggers, skills, and instructions. |
| [Brainstorm](agents/Brainstorm.agent.md) | Generate architectural alternatives, edge cases, and code-pattern options. |
| [BusinessKnowledgeAdvisor](agents/BusinessKnowledgeAdvisor.agent.md) | Select specialists for business needs, rules, processes, and impact questions. |
| [BusinessKnowledgeExpert](agents/BusinessKnowledgeExpert.agent.md) | Produce evidence-grounded business-rule, process, and impact analyses. |
| [CodeArchitectureExpert](agents/CodeArchitectureExpert.agent.md) | Document current architecture or propose a target architecture from supplied evidence. |
| [CodeBackendAdvisor](agents/CodeBackendAdvisor.agent.md) | Select backend approaches for APIs, frameworks, GraphQL/tRPC, and databases. |
| [CodeComfyUICustomNodeSpecialist](agents/CodeComfyUICustomNodeSpecialist.agent.md) | Develop and debug ComfyUI custom nodes, packs, and frontend extensions. |
| [CodeContextSchemaAuditor](agents/CodeContextSchemaAuditor.agent.md) | Audit schemas, dependencies, configuration, and environment constraints. |
| [CodeDatabaseORMGenerator](agents/CodeDatabaseORMGenerator.agent.md) | Generate database schemas, migrations, indexes, and ORM setup. |
| [CodeDesignSystemSpecialist](agents/CodeDesignSystemSpecialist.agent.md) | Build shared UI components, design tokens, themes, and documentation. |
| [CodeDomainAdvisor](agents/CodeDomainAdvisor.agent.md) | Select coding specialists for cross-stack work. |
| [CodeExpressSpecialist](agents/CodeExpressSpecialist.agent.md) | Implement and debug Express APIs using repository conventions. |
| [CodeFastApiSpecialist](agents/CodeFastApiSpecialist.agent.md) | Scaffold and implement FastAPI services with Pydantic and SQLAlchemy. |
| [CodeFrameworkDiagnostician](agents/CodeFrameworkDiagnostician.agent.md) | Diagnose framework errors and validate local dependencies. |
| [CodeFrontendAdvisor](agents/CodeFrontendAdvisor.agent.md) | Select frontend specialists for Next.js, Vite/React, or design systems. |
| [CodeGeneralist](agents/CodeGeneralist.agent.md) | Implement, review, debug, or refactor when no specialist fits. |
| [CodeGraphQLTRPCAgent](agents/CodeGraphQLTRPCAgent.agent.md) | Build GraphQL APIs and tRPC services. |
| [CodeMockupWireframeSpecialist](agents/CodeMockupWireframeSpecialist.agent.md) | Produce direct, readable screen and flow mockups. |
| [CodeNextJsSpecialist](agents/CodeNextJsSpecialist.agent.md) | Build and maintain Next.js applications and APIs. |
| [CodeProductModernizationExpert](agents/CodeProductModernizationExpert.agent.md) | Assess product modernization opportunities and define target workflows. |
| [CodeQualityGuardrailReviewer](agents/CodeQualityGuardrailReviewer.agent.md) | Independently review specifications, designs, and code for defects and risks. |
| [CodeReactViteSpecialist](agents/CodeReactViteSpecialist.agent.md) | Build React and Vite frontends with TypeScript. |
| [CodeRebuildEngineer](agents/CodeRebuildEngineer.agent.md) | Produce an evidence-linked As-Is System Reference or integrate supplied reports. |
| [CodeSpringBootSpecialist](agents/CodeSpringBootSpecialist.agent.md) | Implement and debug Spring Boot services using existing project conventions. |
| [ContextSummarizer](agents/ContextSummarizer.agent.md) | Create concise checkpoints for long or interrupted sessions. |
| [DocsGovernanceAdvisor](agents/DocsGovernanceAdvisor.agent.md) | Select documentation and governance specialists for ADRs, GitHub, and research. |
| [GovArchitectureRecordsExpert](agents/GovArchitectureRecordsExpert.agent.md) | Draft and maintain ADRs, RFCs, and architecture records. |
| [GovDocumentationSuiteGenerator](agents/GovDocumentationSuiteGenerator.agent.md) | Write repository documentation and generate documentation suites. |
| [GovGitWorkflowAgent](agents/GovGitWorkflowAgent.agent.md) | Manage authorized Git branches, commits, pushes, pull requests, and recovery. |
| [GovGithubAgent](agents/GovGithubAgent.agent.md) | Plan agent capabilities and manage GitHub issue triage and filing. |
| [GovOfficeDocumentGenerator](agents/GovOfficeDocumentGenerator.agent.md) | Create and validate PowerPoint and Visio deliverables. |
| [GovWebResearchAgent](agents/GovWebResearchAgent.agent.md) | Research current web sources and return evidence-linked findings. |
| [InfraCIDiagnostics](agents/InfraCIDiagnostics.agent.md) | Diagnose CI and GitHub Actions failures and propose minimal fixes. |
| [InfraCloudDeploymentAgent](agents/InfraCloudDeploymentAgent.agent.md) | Design and implement cross-cloud deployment and provisioning. |
| [InfraDevContainerSpecialist](agents/InfraDevContainerSpecialist.agent.md) | Configure development containers and workspace environments. |
| [InfraDevOpsAdvisor](agents/InfraDevOpsAdvisor.agent.md) | Select DevOps specialists for infrastructure, deployment, and security work. |
| [InfraIaCGenerator](agents/InfraIaCGenerator.agent.md) | Generate and validate Terraform, Pulumi, Bicep, and ARM infrastructure. |
| [InfraKubernetesEngineer](agents/InfraKubernetesEngineer.agent.md) | Engineer Kubernetes manifests, networking, RBAC, and operations. |
| [InfraLLMInferenceSpecialist](agents/InfraLLMInferenceSpecialist.agent.md) | Diagnose and configure local LLM inference and model capacity. |
| [InfraMCPServerGenerator](agents/InfraMCPServerGenerator.agent.md) | Scaffold MCP servers and editor integrations. |
| [InfraMonorepoManager](agents/InfraMonorepoManager.agent.md) | Coordinate package dependencies, versions, and affected builds. |
| [InfraObservabilitySpecialist](agents/InfraObservabilitySpecialist.agent.md) | Set up logging, tracing, metrics, and monitoring. |
| [InfraPerformanceProfiler](agents/InfraPerformanceProfiler.agent.md) | Profile Python and Node.js CPU or memory performance. |
| [InfraReleaseManager](agents/InfraReleaseManager.agent.md) | Prepare releases, changelogs, and stage-specific publication plans. |
| [InfraSecurityAuthAgent](agents/InfraSecurityAuthAgent.agent.md) | Design and diagnose authentication, authorization, RBAC, and secrets. |
| [InfraTestInfrastructureGenerator](agents/InfraTestInfrastructureGenerator.agent.md) | Generate test suites, fixtures, mocks, coverage, and CI gates. |
| [MultiLanguageBuilder](agents/MultiLanguageBuilder.agent.md) | Coordinate Python, Node.js, and TypeScript builds and dependencies. |
| [Aro](agents/Aro.agent.md) | Orchestrate advisor-led specialist selection, task sequencing, and result synthesis. |
| [UtilityAdvisor](agents/UtilityAdvisor.agent.md) | Select specialists for agent diagnostics, alternatives, and checkpoints. |

</details>

<br>

For Aro’s routing sequence and model-selection details, see [the agent guide](docs/agents.md#aro-routing).

## Skills

The extension also includes 10 reusable guides for common tasks, such as investigating a problem, improving an interface, preparing a release, or writing technical documents.

<details>
<summary>Browse all 10 skills</summary>

| Skill | Area | Use it for |
| --- | --- | --- |
| [agent-model-benchmark](skills/agent-model-benchmark/SKILL.md) | Evaluation | Explicit, paired, read-only model trials with fixed rubrics and verified usage telemetry. |
| [container-display-operations](skills/container-display-operations/SKILL.md) | Operations | Containerized display scheduling, timezones, restart behavior, and host/device access boundaries. |
| [frontend-experience-quality](skills/frontend-experience-quality/SKILL.md) | Frontend | Responsive interfaces, design-system consistency, and functional interaction checks. |
| [go-contract-validation](skills/go-contract-validation/SKILL.md) | Backend | Go interfaces and provider adapters, especially cancellation, deadlines, idempotency, cleanup, and error propagation. |
| [identity-failure-isolation](skills/identity-failure-isolation/SKILL.md) | Security | CI authentication and authorization diagnosis using sanitized OIDC, GitHub App, tenant, and secret-reference evidence. |
| [markdown-mermaid-delivery](skills/markdown-mermaid-delivery/SKILL.md) | Documentation | Native Markdown and readable Mermaid diagrams with honest rendering status. |
| [progressive-investigation](skills/progressive-investigation/SKILL.md) | Investigation | Scoped debugging and review from a concrete anchor, falsifiable hypothesis, and cheapest discriminating check. |
| [release-contract-preflight](skills/release-contract-preflight/SKILL.md) | Release | Artifact provenance, overlays, storage ownership, rollback, and stage-specific authorization. |
| [secure-development-bootstrap](skills/secure-development-bootstrap/SKILL.md) | Environment | Development setup across local hosts, SSH, containers, and Codespaces, including safe secret delivery. |
| [specification-handoff](skills/specification-handoff/SKILL.md) | Planning | Turning approved specifications into portable implementation handoffs with requirements, acceptance criteria, and evidence. |

</details>

## Aro Model Learning (Experimental)

Open the **Agent Roster** activity-bar view and select **Open Aro Learning** to see price-aware recommendations by specialist role and task type. A contextual UCB-style policy balances observed outcomes, conservative exploration, and model price. Aro records outcomes only after checking explicit acceptance criteria; ambiguous failures do not count against a model. Exploration is limited to low-risk simple or standard tasks. The scorecard is stored in this VS Code profile and contains no prompts or responses. Aro can request the recommended subagent model when the runtime accepts its exact ID; actual model resolution may not be observable. Rates use native metadata when available and a dated snapshot fallback otherwise. This updates recommendations, not model weights or training data.

Recommendation scoring considers the full eligible inventory, but the tool returns a bounded shortlist to reduce chat context. The shortlist includes the top candidates and eligible provider, learned, and configured Copilot fallbacks where available; its truncation flag indicates when other eligible candidates were omitted.

The sidebar shows the current scope and priority, selected cloud and local counts, unrated local models, outcome count, and the current recommendation for the most recently recorded role and task. Select the scope or priority row to change it; open the dashboard for the complete inventory and scorecard. The latest-context recommendation is recalculated from current settings and is not proof of which model ran.

Use **Model scope** to select Cloud only, Local only, or Both. Local only and Both are available when at least one local model is checked, even if it is unrated. Explicitly clearing the last checked local model changes the scope to Cloud only; if a provider is temporarily unavailable, Cloud only is used until it returns without overwriting the saved scope. With Both selected, choose Cloud first or Local first in **Priority**. The preferred group is tried first, falling back to the other when no eligible priced model is available for the task. Priority defaults to Cloud first and is retained when switching scopes. In **Model inventory**, use each checkbox to include or exclude a model, or use the provider buttons to select or clear all of a provider's models, including those hidden by search. The provider, family and version come from VS Code model metadata. Under **Provider types**, assign other providers as Cloud or Local; unknown providers are not eligible. The `copilot` and `copilotcli` vendors are always Cloud; vendors in the machine setting `agentRoster.modelLearning.localModelVendors` default to Local. Existing per-model classifications remain in effect until their provider type is explicitly changed, except the fixed Copilot cloud providers. The shared **Tier** column shows a price-derived tier for cloud models and a manually assigned capability tier for local models. For local models, Low supports simple tasks, Medium supports simple and standard tasks, and High supports all categories. Unrated local models are not eligible. Price is only a proxy, not verified evidence of model capability. Only mark providers you know are local as Local: local token charges are treated as zero, without estimating hardware or energy costs. For an unpriced cloud model, choose a manual price tier in its row to make it eligible; this is a rough selection estimate, not a quoted token rate, and native or snapshot pricing takes precedence if it later becomes available. Choices are stored in the VS Code profile and do not erase outcome history. Runtime support for requesting a particular subagent model is not guaranteed.

## Privacy And Permissions

The extension contributes two Aro model-learning tools backed by this VS Code profile's global state. Outcome records contain the requested model ID, role, task category, outcome, fixed evidence code, timestamp and optional worker name; the scorecard retains at most 1,000 records. The profile also stores inventory choices, including provider and model identifiers, scope, priority, selections and manual tiers. The local-provider vendor setting is machine-scoped. The learning feature does not store prompts or responses. Other agent tasks use tools available in Copilot Chat. Review proposed changes and permission prompts before approving them.

## License

This project is available under the [PolyForm Noncommercial License 1.0.0](LICENSE). It permits noncommercial use; commercial use requires separate permission from the rights holder. See the license for full terms.

For project maintenance and contributor information, see [maintenance](docs/maintenance.md).