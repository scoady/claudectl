---
name: datadog-auth-datadog-access
description: Use when observability tooling needs Datadog API credentials or site metadata from the installed auth provider.
---

# Datadog Access

Use the installed Datadog auth provider when observability tooling needs
Datadog credentials or site metadata.

## Rules

- Check `c9s auth status` for both `datadog.api_key` and `datadog.app_key`
  before assuming full Datadog API access.
- Treat `DD_SITE` as the current Datadog site/profile indicator.
- Do not pass Datadog secrets on command lines.

## Capabilities

This provider exports:

- `datadog.api_key`
- `datadog.app_key`
- `datadog.site`
