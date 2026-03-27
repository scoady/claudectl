---
name: openai-auth-openai-access
description: Use when a tool or workflow needs OpenAI API credentials or OpenAI endpoint metadata from the installed auth provider.
---

# OpenAI Access

Use the installed OpenAI auth provider when a tool or workflow needs model API
access.

## Rules

- Check `c9s auth status` for `openai.api_key` before assuming OpenAI-backed
  tooling is available.
- Prefer provider-backed environment configuration over embedding keys in
  commands.
- Treat `OPENAI_BASE_URL` as the source of truth when a non-default endpoint is
  required.

## Capabilities

This provider exports:

- `openai.api_key`
- `openai.base_url`
- `openai.org_id`
