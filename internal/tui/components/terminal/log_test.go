package terminalcomponent

import "testing"

func TestEventVisibility(t *testing.T) {
	shared := Event{Audience: EventAudienceShared, Content: "shared"}
	if !shared.VisibleTo(EventAudienceAgent) || !shared.VisibleTo(EventAudienceSystem) {
		t.Fatalf("shared event should be visible to both audiences")
	}

	agent := Event{Audience: EventAudienceAgent, Content: "agent"}
	if !agent.VisibleTo(EventAudienceAgent) {
		t.Fatalf("agent event should be visible to agent audience")
	}
	if agent.VisibleTo(EventAudienceSystem) {
		t.Fatalf("agent event should not be visible to system audience")
	}
}

func TestEventLogAppendAndFilter(t *testing.T) {
	log := NewEventLog(
		Event{Audience: EventAudienceAgent, Content: "agent"},
		Event{Audience: EventAudienceSystem, Content: "system"},
		Event{Audience: EventAudienceShared, Content: "shared"},
		Event{Audience: EventAudienceAgent, Content: "   "},
	)

	agentEvents := log.Filter(EventAudienceAgent)
	if len(agentEvents) != 2 {
		t.Fatalf("expected 2 agent-visible events, got %d", len(agentEvents))
	}

	systemEvents := log.Filter(EventAudienceSystem)
	if len(systemEvents) != 2 {
		t.Fatalf("expected 2 system-visible events, got %d", len(systemEvents))
	}
}
