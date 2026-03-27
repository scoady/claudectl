---
name: atlassian-auth-atlassian-access
description: Use when a workflow needs Jira or Confluence credentials and base URL metadata from the installed Atlassian auth provider.
---

# Atlassian Access

Use the installed Atlassian auth provider when a workflow needs Jira or
Confluence access.

## Rules

- Check `c9s auth status` before assuming Jira or Confluence tokens are set.
- Use the Jira and Confluence base URL capabilities to target the right tenant.
- Keep credentials in provider-backed environment configuration rather than
  inline commands.

## Capabilities

This provider exports:

- `jira.api_token`
- `jira.base_url`
- `jira.user_email`
- `confluence.api_token`
- `confluence.base_url`
- `confluence.user_email`
