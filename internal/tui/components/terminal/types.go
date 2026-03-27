package terminalcomponent

import "strings"

type EventKind string

const (
	EventKindMessage  EventKind = "message"
	EventKindTool     EventKind = "tool"
	EventKindStream   EventKind = "stream"
	EventKindThinking EventKind = "thinking"
	EventKindCommand  EventKind = "command"
	EventKindResult   EventKind = "result"
	EventKindStatus   EventKind = "status"
)

type EventSource string

const (
	EventSourceUserAgent  EventSource = "user_agent"
	EventSourceUserSystem EventSource = "user_system"
	EventSourceAssistant  EventSource = "assistant"
	EventSourceTool       EventSource = "tool"
	EventSourceSystem     EventSource = "system"
)

type EventAudience string

const (
	EventAudienceAgent  EventAudience = "agent"
	EventAudienceSystem EventAudience = "system"
	EventAudienceShared EventAudience = "shared"
)

type Event struct {
	ID        string
	Timestamp string
	Kind      EventKind
	Source    EventSource
	Audience  EventAudience
	Content   string
	Labels    []string
	Metadata  map[string]string
}

func (e Event) NormalizedContent() string {
	return strings.TrimSpace(strings.ReplaceAll(e.Content, "\r\n", "\n"))
}

func (e Event) VisibleTo(audience EventAudience) bool {
	switch e.Audience {
	case EventAudienceShared:
		return true
	case EventAudienceAgent:
		return audience == EventAudienceAgent
	case EventAudienceSystem:
		return audience == EventAudienceSystem
	default:
		return false
	}
}

func (e Event) IsEmpty() bool {
	return e.NormalizedContent() == "" && len(e.Labels) == 0
}
