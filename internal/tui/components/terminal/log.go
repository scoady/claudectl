package terminalcomponent

type EventLog struct {
	events []Event
}

func NewEventLog(events ...Event) EventLog {
	log := EventLog{}
	for _, event := range events {
		log.Append(event)
	}
	return log
}

func (l *EventLog) Append(event Event) {
	if event.IsEmpty() {
		return
	}
	copied := event
	if len(event.Labels) > 0 {
		copied.Labels = append([]string(nil), event.Labels...)
	}
	if len(event.Metadata) > 0 {
		copied.Metadata = map[string]string{}
		for key, value := range event.Metadata {
			copied.Metadata[key] = value
		}
	}
	l.events = append(l.events, copied)
}

func (l EventLog) Events() []Event {
	if len(l.events) == 0 {
		return nil
	}
	out := make([]Event, len(l.events))
	copy(out, l.events)
	return out
}

func (l EventLog) Filter(audience EventAudience) []Event {
	out := make([]Event, 0, len(l.events))
	for _, event := range l.events {
		if event.VisibleTo(audience) {
			out = append(out, event)
		}
	}
	return out
}
