# claudectl

CLI for [Claude Agent Manager](https://github.com/scoady/claude-manager) -- manage AI agent orchestration from your terminal.

## Install

```bash
go install github.com/scoady/claudectl/cmd@latest
```

Or build from source:
```bash
git clone https://github.com/scoady/claudectl.git
cd claudectl
go build -o claudectl ./cmd/
sudo mv claudectl /usr/local/bin/
```

## Commands

| Command | Description |
|---------|-------------|
| `claudectl health` | Backend health check |
| `claudectl status` | Rich dashboard -- projects, agents, stats |
| `claudectl projects [name]` | List projects or detail view |
| `claudectl agents [--active]` | List agents with phase, model, elapsed time |
| `claudectl agents stop <id>` | Kill an agent |
| `claudectl dispatch <project> "<task>" [-f]` | Dispatch task, optionally follow output |
| `claudectl watch <project\|session>` | Live agent output stream |
| `claudectl tasks <project>` | Color-coded task list |
| `claudectl canvas <project>` | Widget listing |
| `claudectl canvas put/rm` | Create/delete widgets |

## Configuration

Default API: `http://localhost:4040`

Override with:
```bash
export CM_API_URL=http://your-backend:4040
claudectl status
```

Or per-command:
```bash
claudectl --api http://your-backend:4040 status
```

## Built With

- [Cobra](https://github.com/spf13/cobra) -- CLI framework
- [Lipgloss](https://github.com/charmbracelet/lipgloss) -- Terminal styling
- [Bubbletea](https://github.com/charmbracelet/bubbletea) -- Interactive TUI
- [Glamour](https://github.com/charmbracelet/glamour) -- Markdown rendering
- [Gorilla WebSocket](https://github.com/gorilla/websocket) -- Live streaming
