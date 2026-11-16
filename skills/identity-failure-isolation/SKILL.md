---
name: identity-failure-isolation
description: Diagnose CI authentication and authorization failures using
  sanitized identity, OIDC, GitHub App, tenant and Secret-reference evidence.
  Use before proposing credential, permission or application changes.
---

# Identity Failure Isolation

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Identity Failure Isolation
1. Collect sanitized failing-step evidence, workflow revision, repository/environment, credential type and intended trust. HTTP status alone does not identify a failed layer.
2. Verify effective workflow/job permissions and credential-request capability before inspecting downstream application code.
3. Compare sanitized OIDC issuer/audience/subject, repository/ref/environment and receiver policy. Never print raw tokens or confuse Actions OIDC with App installation tokens.
4. Verify App installation identity, selected repository IDs and granted permissions through read-only GitHub evidence. Valid identity for another installation is not repository authorization.
5. Check application authorization, allowlists/mapping and payload/schema validation; HTTP 400 is not automatically an identity defect.
6. Verify actual provider/account/project/tenant, trust conditions/actions and effective scope; no automatic administrator grants or provider substitution.
7. Verify Secret delivery reference, namespace/environment, keys and presence using metadata only. Do not fetch or decode values to prove presence.
8. Stop at the first evidenced failure. Return its layer, evidence, one discriminating read-only check, minimal proposal and unknowns. Do not change downstream code before confirming upstream identity.

## Role Boundaries

Diagnosis is read-only unless a specific repair is authorized. Do not widen trust, roles, repository access or tenant scope, rotate secrets, regenerate tokens or reauthenticate automatically. Distinguish invalid identity from valid identity lacking access.
