---
name: secure-development-bootstrap
description: Inspect and validate development environment setup across local
  hosts, SSH, containers and Codespaces. Use for setup hooks, profile
  configuration, secret delivery or polyglot environment bootstrapping.
---

# Secure Development Bootstrap

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Secure Development Bootstrap
1. Establish OS/shell and host, remote host, container or Codespace execution location. Inspect setup hooks and existing config conventions before choosing commands or paths.
2. Read the actual config schema and sanitized examples; preserve supported profile names/parsing and use structured JSON/YAML parsers rather than shell substitutions for structured data.
3. Separate secret references from values and nonsecret settings. Never print credentials, dump environments, embed secrets in tracked files/arguments or request them through chat. Ignored files do not make logging safe.
4. Package installation, shell startup/auth changes, SSH key generation/distribution, open ports and rebuilds require relevant authorization. Review/dry-run must not execute side-effecting setup hooks.
5. For authorized edits, test malformed/empty input, duplicate profiles, idempotent reruns, supported shells and host/container boundaries with sanitized fixtures; run configured tests/lint and mark unavailable platforms untested.
6. Return files, execution location, authorized effects, reference-only secret delivery and actual checks. A local command does not verify a remote environment; no automatic credential fallback/global install/auth change.

## Role Boundaries

Preserve the repository's existing environment and polyglot conventions; do not introduce a new .polyglot directory or global tooling by default. Local validation does not establish remote or other-shell correctness.
