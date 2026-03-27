package blocks

type Milestone struct {
	Tag     string
	Title   string
	Summary string
}

type MilestonesBlock struct {
	ID         string
	ZoneID     string
	Title      string
	Badge      string
	Accent     string
	Placement  Placement
	Sizing     Sizing
	Milestones []Milestone
}

func (b MilestonesBlock) BlockID() string           { return b.ID }
func (b MilestonesBlock) BlockPlacement() Placement { return b.Placement }
func (b MilestonesBlock) BlockSizing() Sizing       { return b.Sizing }

func (b MilestonesBlock) BlockHeader() Header {
	return Header{
		ZoneID: b.ZoneID,
		Title:  b.Title,
		Badge:  b.Badge,
		Accent: accentColor(b.Accent),
	}
}

func (b MilestonesBlock) RenderBody(width, height int) []string {
	lines := make([]string, 0, len(b.Milestones)*3)
	if len(b.Milestones) == 0 {
		lines = append(lines, mutedStyle().Render("No milestones yet."))
		return padOrTrim(lines, height)
	}
	for _, item := range b.Milestones {
		tag := item.Tag
		if tag == "" {
			tag = "milestone"
		}
		lines = append(lines, titleStyle(accentColor(b.Accent)).Render(tag+"  "+item.Title))
		if item.Summary != "" {
			lines = append(lines, mutedStyle().Render(item.Summary))
		}
		lines = append(lines, "")
	}
	return padOrTrim(lines, height)
}
