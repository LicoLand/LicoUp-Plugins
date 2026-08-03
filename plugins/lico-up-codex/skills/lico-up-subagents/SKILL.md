---
name: lico-up-subagents
description: Discover and delegate bounded work to locally available subordinate agents through LicoUp.
---

# LicoUp subagents

Use this skill when a task benefits from a separate local agent conversation. LicoUp owns target discovery and native conversation transport. The main Codex agent keeps planning, routing, review, and final acceptance authority.

1. Call `lico_subagents_list` before delegation. Select only an agent and model returned by the scan. `sameFramework: true` creates a separate conversation; it never resumes the current Codex task.
2. Use `lico_subagent_probe` only for adapter or exact-route readiness. Ordinary probes should omit exact model settings. A probe passes only after its disposable history is removed and verified absent by LicoUp.
3. Call `lico_subagent_delegate` with one bounded task, a lifecycle `role`, and the exact absolute `workingDirectory`. Use explicit timeout or output budgets only when the bounded task needs them.
4. Read the returned private `conversationPath` locally and review the subordinate result. Never publish or log this path.
5. Use `lico_subagent_continue` with the same path and role for revisions. Keep follow-ups for one conversation ordered.
6. Use `lico_subagent_cancel` only when an active subordinate turn no longer serves the task.

Do not delegate secrets, credentials, private runtime records, unrelated user data, or authority broader than the current user request. Native approval options authorize the selected agent's tools; they do not create an operating-system sandbox.
