package tui

type workspaceShellRect struct {
	X int
	Y int
	W int
	H int
}

func (r workspaceShellRect) contains(x, y int) bool {
	return x >= r.X && x < r.X+r.W && y >= r.Y && y < r.Y+r.H
}

type workspaceShellLayout struct {
	Activity   workspaceShellRect
	Sidebar    workspaceShellRect
	Main       workspaceShellRect
	Transcript workspaceShellRect
	Preview    workspaceShellRect
	Composer   workspaceShellRect
	Picker     workspaceShellRect
	Stacked    bool
}

type workspaceShellTabHit struct {
	Name       string
	StartX     int
	EndX       int
	CloseStart int
	CloseEnd   int
	Add        bool
}

type workspaceShellFileTabHit struct {
	Path       string
	StartX     int
	EndX       int
	CloseStart int
	CloseEnd   int
}

type workspaceShellCanvasTabHit struct {
	Name   string
	StartX int
	EndX   int
}

type workspaceShellDockSlot struct {
	Mode      string
	IconLine  int
	LabelLine int
	StartLine int
	EndLine   int
}

type workspaceTabAction struct {
	kind string
	name string
}
