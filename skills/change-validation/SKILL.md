---
name: change-validation
description: Choose and run proportionate validation for authorized code changes using the target repository's configured checks.
---

# Change validation

Use this skill after an authorized code change when choosing how to verify it.
Do not use it to turn a read-only review or diagnosis into permission to edit.

1. Follow the target repository's instructions and inspect its existing scripts,
   test configuration, and relevant CI checks. Do not assume a language, package
   manager, or command from another repository.
2. Select the smallest configured checks that exercise the changed behavior.
   Include type-check/build checks when affected, and expand to integration,
   extension-host, packaging, or broader suites only when the change touches
   those boundaries or the repository requires them.
3. Do not run every check by default, invent lint commands, install dependencies
   without a missing-dependency reason, or treat a successful compile as proof
   of runtime behavior.
4. Run checks in the repository's supported environment. Do not claim that a
   local check validates a remote service, device, deployment, or live model
   request.
5. Report exact commands and outcomes. Separate checks that passed, failed,
   were not run, or were blocked, and explain any remaining validation gap.
