# Core Plugins

`core_plugins/` holds bundled plugin sources that ship with `codexctl`.

These plugins use the same repo contract as external plugins:

- `codex-tool.json`
- `external_skills/<skill>/SKILL.md`
- `kind` to describe runtime behavior
- optional `tags` for grouping and discovery

Core plugins exist for capabilities that many users will need and that make
sense to keep versioned with `codexctl`, such as auth providers and common
integration helpers.

## Rules

- Keep the plugin source self-contained inside its own directory.
- Prefer manifest-driven behavior over hardcoded logic in `codexctl`.
- Export only the skills that should be inherited by Codex.
- Use `kind: "auth-provider"` for provider plugins that expose reusable auth
  capabilities to other tools.
- Use `kind: "skill-pack"` for context-only plugins that provide skills but no
  runtime binary.

## Layout

```text
core_plugins/
  gitlab-auth/
    codex-tool.json
    external_skills/
      gitlab-access/
        SKILL.md
```
