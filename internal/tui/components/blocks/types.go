package blocks

import "github.com/charmbracelet/lipgloss"

type Placement struct {
	Col     int
	Row     int
	ColSpan int
	RowSpan int
}

type Sizing struct {
	MinHeight       int
	PreferredHeight int
}

type Header struct {
	ZoneID string
	Title  string
	Badge  string
	Accent lipgloss.Color
}

type Block interface {
	BlockID() string
	BlockPlacement() Placement
	BlockSizing() Sizing
	BlockHeader() Header
	RenderBody(width, height int) []string
}

type Canvas struct {
	Columns int
	Gap     int
	Blocks  []Block
}

func NewCanvas(columns, gap int, blocks ...Block) Canvas {
	cloned := make([]Block, 0, len(blocks))
	cloned = append(cloned, blocks...)
	if columns <= 0 {
		columns = 12
	}
	if gap < 0 {
		gap = 0
	}
	return Canvas{
		Columns: columns,
		Gap:     gap,
		Blocks:  cloned,
	}
}
