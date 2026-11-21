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

## Evidence Before Asking
- Before asking the user for a log, console, task output or trace, check the evidence you can already read: pasted excerpts and runtime-supplied paths your tools can open. Do not search personal profiles for logs.
- Name each source by its origin. A Copilot Chat session trace records chat routing, prompts and tool calls; it does not contain VS Code Extension Host, Debug Console or Tasks output, and it cannot prove that either ran or failed. Read only the entries needed for the symptom.
- Report which sources you read, the fields or lines you relied on, and what you could not read. State log contents only from text you actually read.
- If a source is missing, unreadable or outside your tools, name the exact missing source, where the user can obtain it, and the smallest sanitized excerpt that would discriminate between hypotheses. Remove secrets and unrelated content from any requested excerpt.

## Role Boundaries

Review and diagnosis remain read-only. For authorized code changes, validate the smallest change immediately, then run relevant tests and configured lint on the final result. Do not expand tool permissions or read the whole repository simply to gain confidence.
