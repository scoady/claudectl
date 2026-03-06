# c9s

A k9s-style interactive TUI for [Claude Agent Manager](https://github.com/scoady/claude-manager) -- manage AI agent orchestration from your terminal.

## Install

```bash
go install github.com/scoady/claudectl/cmd@latest
```

Or build from source:
```bash
git clone https://github.com/scoady/claudectl.git
cd claudectl
go build -o c9s ./cmd/
sudo mv c9s /usr/local/bin/
```

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
