package metricscomponent

type Item struct {
	Label string
	Value string
	Spark string
	Color string
}

type Model struct {
	Items      []Item
	RightLabel string
}

func NewModel(items []Item, rightLabel string) Model {
	cloned := make([]Item, 0, len(items))
	cloned = append(cloned, items...)
	return Model{
		Items:      cloned,
		RightLabel: rightLabel,
	}
}
