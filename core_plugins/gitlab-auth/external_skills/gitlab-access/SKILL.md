---
name: gitlab-auth-gitlab-access
description: Use when a task needs GitLab-backed catalog access, private repository installs, merge request or pipeline inspection, or GitLab API automation.
---

# GitLab Access

Use the installed GitLab auth provider when a task needs access to private
GitLab-backed resources such as:

- tool catalog refresh
- private repository installation
- merge request and pipeline inspection
- GitLab API-backed automation

## Rules

- Prefer provider-backed auth over ad hoc token prompts.
- Use `c9s auth status` to confirm whether `gitlab.api_token` is available.
- If GitLab-backed catalog actions are unavailable, tell the user to configure
  `GITLAB_TOKEN` or authenticate `glab`.
- Do not paste tokens into command lines or logs.

## Capability

This provider exports:

- `gitlab.api_token`
