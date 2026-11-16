---
name: release-contract-preflight
description: Verify release artifacts, provenance, overlays, storage ownership,
  rollback and stage-specific authorization. Use before release preparation,
  publication, infrastructure planning or rollout.
---

# Release Contract Preflight

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Release Contract Preflight
1. Record source/deployment ownership, requested stage, authorized artifact/version/environment and allowed mutations. Preparation, Git mutation, publication and rollout remain distinct.
2. Establish source revision, artifact name/version, image/chart relationship, digest/provenance policy, overlay/schema, credential-generation references, storage ownership/retention, readiness and rollback. Mark missing evidence explicitly.
3. Verify published metadata through available read-only evidence. Recording a pulled digest is not proof of a reviewed digest match or provenance. Preserve the approved contract; do not silently strengthen or weaken it.
4. Validate the exact reviewed artifact with its intended overlay/schema, image names and release context. A source-directory render does not prove equivalence to the published artifact. Request sanitized cluster/runner/Secret-reference evidence when unavailable.
5. Confirm existing Namespace/PV/PVC/release ownership and binding before a proposed rollout. Retention is not backup or adoption permission; stored release manifests can affect ownership transitions. Never mutate retained storage to finish a release.
6. Run configured tests/lint/render checks for authorized changes. Return Git mutations to Orchestrator for GovGitWorkflowAgent; rollout uses a separately authorized infrastructure worker. Only Orchestrator coordinates workers.
7. Require bounded waits, dependency-aware sequencing, rollback prerequisites and ready/failed/blocked/not-run status for every requested workload from a rollout handoff. Inspect existing results before retrying ambiguous publication; stop on incompatible artifacts, ownership or missing prerequisites.
8. Return the verified contract, unknowns, stage authorizations and checks actually run.

## Role Boundaries

For IaC, distinguish planning from apply and do not claim a plan proves absence of drift. For rollout, verify namespace and retained volume ownership, bounded waits, dependency sequencing, each workload state and rollback prerequisites. Never treat storage retention as backup or adoption permission.
