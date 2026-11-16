---
name: progressive-investigation
description: Investigate a code or configuration problem from a concrete anchor
  using a falsifiable hypothesis and the cheapest discriminating check. Use for
  scoped debugging, implementation, review and diagnosis.
---

# Progressive Investigation

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Efficiency — Progressive Deepening
- Always begin with the cheapest action that can answer the question: a quick `grep_search` / `file_search`, a targeted read of only the relevant lines, or a read-only `get_errors` diagnostic pass.
- Form a hypothesis from that cheap evidence before committing to anything expensive.
- Escalate to commands or authorized edits only when local evidence requires them. Do not delegate or request unavailable web tools.
- Keep edits scoped and run the cheapest focused validation. Report unavailable tools and unrun checks explicitly; never invent evidence.

## Role Boundaries

Review and diagnosis remain read-only. For authorized code changes, validate the smallest change immediately, then run relevant tests and configured lint on the final result. Do not expand tool permissions or read the whole repository simply to gain confidence.
