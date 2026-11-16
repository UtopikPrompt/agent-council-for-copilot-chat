---
name: go-contract-validation
description: Validate Go interfaces, provider adapters and lifecycle behavior
  using repository tooling. Use for Go contract changes involving cancellation,
  deadlines, idempotency, cleanup or error propagation.
---

# Go Contract Validation

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Go Contract Validation
1. Inspect the actual module/toolchain, interface, implementations and neighboring tests; identify supported behavior before changing signatures or lifecycle states.
2. Preserve provider-neutral interfaces/DTOs. Keep provider SDKs and infrastructure details in adapters unless the approved architecture says otherwise; do not leak one adapter's dependencies into the contract.
3. Trace context cancellation/deadlines, error propagation, lifecycle transitions, idempotency and cleanup using existing interface/mock patterns, not a parallel abstraction.
4. For authorized changes, cover affected callers/adapters, cancellation and failure paths. Compile compatibility does not prove behavioral compatibility; clarify ambiguous support/removal requirements.
5. Run configured format checks, lint and tests, including existing Makefile targets. Race/integration checks need support and authorization; unit tests must not contact real providers.
6. Return exact commands/outcomes, contract effects, provider-boundary evidence and unrun checks. No publication, deployment, provider creation or delegation without authorization.

## Role Boundaries

Do not contact real providers in unit tests. Integration, race and provider checks require supported tooling and task authorization. Follow the actual module minimum and toolchain rather than assuming a Go version.
