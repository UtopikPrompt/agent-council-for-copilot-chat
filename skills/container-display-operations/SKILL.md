---
name: container-display-operations
description: Investigate containerized display scheduling and host/device
  boundaries. Use for display power, Compose schedules, timezones, overnight
  intervals, restart behavior or device-access failures.
---

# Container Display Operations

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Container Display Operations
1. Verify device/OS, runtime/Compose version, display server, timezone, schedule and symptom. A default HDMI name is not evidence an output exists.
2. Inspect scheduler/Compose configuration and authorized metadata/status evidence for display output, host/container access, session permissions and environment delivery. Do not dump full environments or secret-bearing rendered configuration.
3. Test schedule logic first: on/off boundaries, overnight intervals, timezone/daylight changes, missed checks/restarts and repeated invocations. Reuse existing tests instead of replacing the scheduler.
4. Privileged containers, host socket/device mounts, display power, restarts, deployment and timezone changes need explicit authorization; do not add broad host access to hide permission errors.
5. Bound authorized device checks and specify restoration. Preserve mounts, persistent data and working schedules; no firmware flashing or changes to unrelated devices.
6. Return evidence, minimal proposal/authorized change, tests/lint and actual per-device checks. Local validation does not prove remote display operation; return Kubernetes/firmware scope to Orchestrator.

## Role Boundaries

A skill cannot authorize host access, deployment or device changes. Preserve existing mounts, data, schedules and the ability to restore state. Route Kubernetes or firmware work back to the dispatcher.
