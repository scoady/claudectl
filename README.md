# c9s

A k9s-style interactive TUI for Codex-based agent orchestration from your terminal.

## Install

```bash
go install github.com/scoady/codexctl/cmd@latest
```

Or build from source:
```bash
git clone https://github.com/scoady/codexctl.git
cd codexctl
go build -o c9s ./cmd/
sudo mv c9s /usr/local/bin/
```

## Development Workflow

When validating local TUI or API changes in this repo, treat backend availability as part of the check:

- ensure the backend is running before validation
- if a fix touches backend startup, HTTP handlers, WebSocket flow, or TUI-to-backend integration, restart the backend before re-testing
- if a fix changes runtime behavior, TUI rendering, or launch flow, build the local `c9s` binary before handoff so the updated executable is ready to run
- plain `c9s` now auto-starts a local backend target such as `http://localhost:4040` when needed, but remote `--api` targets are not started automatically

## Interactive TUI

Launch the interactive terminal UI (no arguments):
```bash
c9s
```

### Key Bindings

| Key | Action |
|-----|--------|
| `Enter` | Drill into selected item |
| `Esc` / `q` | Back / Quit |
| `:` | Command mode (`:agents`, `:projects`, `:q`) |
| `/` | Filter / Search |
| `d` | Detail view |
| `l` | Logs / Stream view |
| `K` | Kill agent |
| `Ctrl+D` | Dispatch hint |
| `Tab` | Cycle panels |
| `1-9` | Quick switch to project |
| `?` | Help overlay |

## CLI Commands

| Command | Description |
|---------|-------------|
| `c9s health` | Backend health check |
| `c9s status` | Rich dashboard -- projects, agents, stats |
| `c9s projects [name]` | List projects or detail view |
| `c9s agents [--active]` | List agents with phase, model, elapsed time |
| `c9s agents stop <id>` | Kill an agent |
| `c9s dispatch <project> "<task>" [-f]` | Dispatch task, optionally follow output |
| `c9s watch <project\|session>` | Live agent output stream |
| `c9s tasks <project>` | Color-coded task list |
| `c9s canvas <project>` | Widget listing |
| `c9s canvas put/rm` | Create/delete widgets |
| `c9s auth status` | Show resolved auth providers and capabilities |

## Tool Integrations

`c9s` can install local CLI tools and import Codex skills that the tool repo explicitly exports.
The tool catalog can include both remote repos and bundled plugins from `core_plugins/`.

### Consume A CLI Tool

Install from a local checkout:

```bash
c9s tools install --source /path/to/my-tool
```

Install from a git repo:

```bash
c9s tools install --source https://git.example.com/team/my-tool.git
```

Install from a specific branch or ref:

```bash
c9s tools install --source https://git.example.com/team/my-tool.git@feature/codex-contract
```

Bundled core plugins appear in the catalog automatically and can also be installed directly from source:

```bash
c9s tools install --source /path/to/codexctl/core_plugins/gitlab-auth
```

This does three things:

- opens the local repo or clones the git source into a managed cache under `~/.local/share/c9s/tools/sources`
- installs the tool runtime into `~/.local/share/c9s/tools/<tool-name>`
- imports exported skills from the source repo into `~/.codex/skills`

Inspect installed tools:

```bash
c9s tools list
```

Inspect exported skills before syncing:

```bash
c9s tools inspect <tool-name>
c9s tools inspect <tool-name> --skill observability --lines 20
```

Re-import exported skills from the source repo:

```bash
c9s tools sync <tool-name>
```

Validate the install and check whether managed skills are in sync with the source repo:

```bash
c9s tools doctor <tool-name>
```

Spawned Codex sessions automatically get installed tool bin directories prepended to `PATH`, so the imported skills can rely on the tool command being available.

### Write A CLI Tool That Works With `c9s`

Keep the runtime behavior in the tool. Export only lightweight trigger guidance as skills.

Required pieces:

- an installable CLI project
- either a `codex-tool.json` manifest or a supported repo convention that `c9s` can infer
- a `kind` that describes runtime behavior, such as `tool`, `auth-provider`, or `skill-pack`
- optional `tags` for catalog filtering and grouping, such as `core`, `auth`, `openai`, `observability`
- a stable command entrypoint, for example `o11y`
- self-documenting help such as `--help`
- an agent-oriented compact help surface such as `codex-help`
- an `external_skills/` directory that explicitly exports inherited skills

Recommended repo shape:

```text
my-tool/
├── codex-tool.json
├── README.md
├── pyproject.toml
├── src/
│   └── my_tool/
│       └── cli.py
└── external_skills/
    └── observability/
        └── SKILL.md
```

Example `external_skills/` layout:

```text
external_skills/
└── observability/
    └── SKILL.md
```

Example minimal skill:

```md
---
name: my-tool-observability
description: Use when the user asks about logs, metrics, traces, incidents, or current production health and the local my-tool CLI can answer directly.
---

# my-tool Observability

Use `my-tool` for current operational questions.

## First step

- Run `my-tool codex-help`
- Run `my-tool --help` for the full CLI surface
```

Example minimal `codex-tool.json`:

```json
{
  "name": "my-tool",
  "kind": "tool",
  "tags": ["observability"],
  "repo_url": "https://git.example.com/team/my-tool.git",
  "skills_dir": "external_skills",
  "install": {
    "type": "python_editable",
    "command": "my-tool",
    "python": ">=3.12",
    "install_target": "."
  }
}
```

Example auth-provider manifest:

```json
{
  "name": "gitlab-auth",
  "kind": "auth-provider",
  "tags": ["core", "auth", "gitlab"],
  "provides": ["gitlab.api_token"],
  "install": {
    "type": "noop",
    "capabilities": [
      {
        "name": "gitlab.api_token",
        "token_env": "GITLAB_TOKEN",
        "base_url_env": "GITLAB_HOST"
      }
    ]
  }
}
```

Example `skill-pack` manifest:

```json
{
  "name": "incident-context",
  "kind": "skill-pack",
  "tags": ["core", "context", "operations"],
  "skills_dir": "external_skills",
  "install": {
    "type": "noop"
  }
}
```

Example compact CLI help contract:

```bash
my-tool codex-help
```

That command should answer:

- when to use the tool
- fastest starting commands
- direct commands for known targets
- any required auth or configuration steps
- a compact summary suitable for agent consumption, such as `codex-help`

Design rules:

- keep exported skills small
- keep detailed command documentation in the tool itself
- treat `external_skills/` as the source of truth for inherited skills
- declare install behavior in `codex-tool.json` when possible
- use `kind` for runtime behavior and `tags` for discovery and grouping
- avoid generating skills from inferred repo intent

### Core Plugins

`core_plugins/` is the bundled plugin workspace inside this repo.

Use it for integrations that many `c9s` users are likely to need and that are
worth versioning with `codexctl`, such as auth providers.

Current example:

```text
core_plugins/
  gitlab-auth/
    codex-tool.json
    external_skills/
      gitlab-access/
        SKILL.md
```

Core plugins follow the same contract as external plugins. The only difference
is discovery: `c9s` can surface them locally in the tool catalog even without
GitLab catalog access.

Bundled auth providers currently scaffolded in `core_plugins/`:

- `gitlab-auth`
  - `gitlab.api_token`
- `openai-auth`
  - `openai.api_key`
  - `openai.base_url`
  - `openai.org_id`
- `datadog-auth`
  - `datadog.api_key`
  - `datadog.app_key`
  - `datadog.site`
- `atlassian-auth`
  - `jira.api_token`
  - `jira.base_url`
  - `jira.user_email`
  - `confluence.api_token`
  - `confluence.base_url`
  - `confluence.user_email`

Inspect the currently resolved provider state with:

```bash
c9s auth status
```

## Shell Completion

Tab-complete commands, project names, session IDs, widget IDs, and model names.

```bash
# Bash
c9s completion bash > /etc/bash_completion.d/c9s

# Zsh (add to fpath before compinit)
c9s completion zsh > "${fpath[1]}/_c9s"

# Fish
c9s completion fish > ~/.config/fish/completions/c9s.fish
```

Dynamic completions fetch live data from the backend -- project names, session IDs, widget IDs, and model names are all completed from the running API.

## Configuration

Default API: `http://localhost:4040`

Override with:
```bash
export CM_API_URL=http://your-backend:4040
c9s
```

Or per-command:
```bash
c9s --api http://your-backend:4040 status
```

## Built With

- [Cobra](https://github.com/spf13/cobra) -- CLI framework
- [Lipgloss](https://github.com/charmbracelet/lipgloss) -- Terminal styling
- [Bubbletea](https://github.com/charmbracelet/bubbletea) -- Interactive TUI
- [Gorilla WebSocket](https://github.com/gorilla/websocket) -- Live streaming
