package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/tools"
)

type ToolEntry struct {
	Record     tools.Record
	Inspection *tools.ToolInspection
	Doctor     *tools.DoctorResult
}

type ToolsDataMsg struct {
	Entries         []ToolEntry
	Catalog         []tools.CatalogEntry
	LoadedAt        time.Time
	CatalogLoadedAt time.Time
	Err             error
	CatalogErr      error
}

type ShowToolInstallMsg struct {
	Source string
}

type ShowToolConfigureMsg struct {
	ToolName string
}

type ToolInstallCompleteMsg struct {
	Record *tools.Record
	Err    error
}

type ToolSyncCompleteMsg struct {
	ToolName string
	Record   *tools.Record
	Err      error
}

type ToolDoctorCompleteMsg struct {
	ToolName string
	Result   *tools.DoctorResult
	Err      error
}

type ToolConfigureCompleteMsg struct {
	ToolName string
	Err      error
}

type ToolCatalogRefreshMsg struct {
	Entries  []tools.CatalogEntry
	LoadedAt time.Time
	Err      error
}

const defaultToolSource = ""

type ToolsModel struct {
	Entries         []ToolEntry
	Catalog         []tools.CatalogEntry
	Selected        int
	Hovered         int
	LoadedAt        time.Time
	CatalogLoadedAt time.Time
	Loading         bool
	Message         string
	Error           string
	CatalogError    string
}

func NewToolsModel() ToolsModel {
	return ToolsModel{}
}

func (m *ToolsModel) ClampSelection() {
	if m.TotalCount() == 0 {
		m.Selected = 0
		return
	}
	if m.Selected < 0 {
		m.Selected = 0
	}
	if m.Selected >= m.TotalCount() {
		m.Selected = m.TotalCount() - 1
	}
	if m.Hovered < -1 {
		m.Hovered = -1
	}
	if m.TotalCount() == 0 {
		m.Hovered = -1
	} else if m.Hovered >= m.TotalCount() {
		m.Hovered = m.TotalCount() - 1
	}
}

func (m *ToolsModel) Current() *ToolEntry {
	if len(m.Entries) == 0 || m.Selected >= len(m.Entries) {
		return nil
	}
	m.ClampSelection()
	return &m.Entries[m.Selected]
}

func (m *ToolsModel) CurrentCatalog() *tools.CatalogEntry {
	catalog := m.VisibleCatalog()
	if len(catalog) == 0 || m.Selected < len(m.Entries) {
		return nil
	}
	idx := m.Selected - len(m.Entries)
	if idx < 0 || idx >= len(catalog) {
		return nil
	}
	return &catalog[idx]
}

func (m *ToolsModel) TotalCount() int {
	return len(m.Entries) + len(m.VisibleCatalog())
}

func (m *ToolsModel) SelectDelta(delta int) {
	if m.TotalCount() == 0 {
		return
	}
	m.Selected += delta
	m.ClampSelection()
}

func (m *ToolsModel) SetHovered(idx int) {
	m.Hovered = idx
	m.ClampSelection()
}

func (m *ToolsModel) SelectedRecord() *tools.Record {
	cur := m.Current()
	if cur == nil {
		return nil
	}
	return &cur.Record
}

func (m *ToolsModel) VisibleCatalog() []tools.CatalogEntry {
	if len(m.Catalog) == 0 {
		return nil
	}
	installed := make(map[string]struct{}, len(m.Entries))
	for _, entry := range m.Entries {
		installed[entry.Record.Name] = struct{}{}
	}
	out := make([]tools.CatalogEntry, 0, len(m.Catalog))
	for _, entry := range m.Catalog {
		if _, ok := installed[entry.Name]; ok {
			continue
		}
		out = append(out, entry)
	}
	return out
}

func (m *ToolsModel) CatalogMatch(name string) *tools.CatalogEntry {
	for _, entry := range m.Catalog {
		if entry.Name == name {
			copy := entry
			return &copy
		}
	}
	return nil
}

func (m *ToolsModel) ApplyData(msg ToolsDataMsg) {
	m.Loading = false
	m.Error = ""
	m.CatalogError = ""
	m.Message = ""
	if msg.Err != nil {
		m.Error = msg.Err.Error()
		return
	}
	m.Entries = msg.Entries
	m.Catalog = msg.Catalog
	m.LoadedAt = msg.LoadedAt
	m.CatalogLoadedAt = msg.CatalogLoadedAt
	if msg.CatalogErr != nil {
		m.CatalogError = msg.CatalogErr.Error()
	}
	m.ClampSelection()
}

func (m *ToolsModel) ApplyCatalog(msg ToolCatalogRefreshMsg) {
	m.CatalogError = ""
	if msg.Err != nil {
		m.CatalogError = msg.Err.Error()
		return
	}
	m.Catalog = msg.Entries
	m.CatalogLoadedAt = msg.LoadedAt
	m.ClampSelection()
}

func RefreshToolsCmd() tea.Cmd {
	return func() tea.Msg {
		records, err := tools.ListRecords()
		if err != nil {
			return ToolsDataMsg{Err: err}
		}

		entries := make([]ToolEntry, 0, len(records))
		for _, record := range records {
			entry := ToolEntry{Record: record}
			if insp, err := tools.InspectInstalledTool(record.Name); err == nil {
				entry.Inspection = insp
			}
			result := tools.DoctorInstalledTool(record.Name)
			entry.Doctor = &result
			entries = append(entries, entry)
		}

		var catalog []tools.CatalogEntry
		var catalogLoadedAt time.Time
		var catalogErr error
		if cache, err := tools.LoadCatalogCache(); err == nil {
			catalog = cache.Entries
			if cache.RefreshedAt != "" {
				if ts, parseErr := time.Parse(time.RFC3339, cache.RefreshedAt); parseErr == nil {
					catalogLoadedAt = ts
				}
			}
		} else {
			catalogErr = err
		}

		return ToolsDataMsg{
			Entries:         entries,
			Catalog:         catalog,
			LoadedAt:        time.Now().UTC(),
			CatalogLoadedAt: catalogLoadedAt,
			CatalogErr:      catalogErr,
		}
	}
}

func RefreshToolCatalogCmd() tea.Cmd {
	return func() tea.Msg {
		cache, err := tools.RefreshCatalog()
		if err != nil {
			return ToolCatalogRefreshMsg{Err: err}
		}
		loadedAt := time.Now().UTC()
		if cache.RefreshedAt != "" {
			if ts, parseErr := time.Parse(time.RFC3339, cache.RefreshedAt); parseErr == nil {
				loadedAt = ts
			}
		}
		return ToolCatalogRefreshMsg{
			Entries:  cache.Entries,
			LoadedAt: loadedAt,
		}
	}
}

func InstallToolCmd(source string) tea.Cmd {
	return func() tea.Msg {
		record, err := tools.InstallToolFromSource(tools.InstallOptions{
			Source:       source,
			InstallSkill: true,
		})
		return ToolInstallCompleteMsg{Record: record, Err: err}
	}
}

func SyncToolCmd(toolName string) tea.Cmd {
	return func() tea.Msg {
		record, err := tools.SyncInstalledTool(toolName)
		return ToolSyncCompleteMsg{ToolName: toolName, Record: record, Err: err}
	}
}

func DoctorToolCmd(toolName string) tea.Cmd {
	return func() tea.Msg {
		result := tools.DoctorInstalledTool(toolName)
		return ToolDoctorCompleteMsg{ToolName: toolName, Result: &result}
	}
}

func ConfigureToolCmd(toolName string, values map[string]string) tea.Cmd {
	return func() tea.Msg {
		return ToolConfigureCompleteMsg{
			ToolName: toolName,
			Err:      tools.SetPluginConfigValues(toolName, values),
		}
	}
}

type ToolInstallModel struct {
	sourceInput textinput.Model
	active      bool
	submitting  bool
	result      string
	err         error
	width       int
	height      int
}

type toolConfigureField struct {
	Spec  tools.ConfigureInputSpec
	Input textinput.Model
}

type ToolConfigureModel struct {
	toolName    string
	fields      []toolConfigureField
	selected    int
	active      bool
	submitting  bool
	width       int
	height      int
	err         error
	description string
}

func NewToolInstallModel(source string) ToolInstallModel {
	input := textinput.New()
	input.Placeholder = "local repo path or git URL"
	input.Focus()
	input.CharLimit = 500
	input.Width = 74
	if strings.TrimSpace(source) == "" {
		source = defaultToolSource
	}
	if source != "" {
		input.SetValue(source)
	}
	return ToolInstallModel{
		sourceInput: input,
		active:      true,
	}
}

func (m ToolInstallModel) Active() bool {
	return m.active
}

func (m ToolInstallModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m ToolInstallModel) Update(msg tea.Msg) (ToolInstallModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			m.active = false
			return m, nil
		case "enter":
			if m.submitting {
				return m, nil
			}
			m.submitting = true
			return m, InstallToolCmd(strings.TrimSpace(m.sourceInput.Value()))
		}

	case ToolInstallCompleteMsg:
		m.submitting = false
		if msg.Err != nil {
			m.err = msg.Err
			m.result = ""
			return m, nil
		}
		m.err = nil
		if msg.Record != nil {
			m.result = msg.Record.Name
		}
		m.active = false
		return m, nil
	}

	var cmd tea.Cmd
	m.sourceInput, cmd = m.sourceInput.Update(msg)
	return m, cmd
}

func (m ToolInstallModel) View() string {
	if !m.active {
		return ""
	}

	ly := NewLayout(m.width, m.height)
	var content strings.Builder

	content.WriteString(Class("dialog-title").Render("  Import Tool From Repo") + "\n\n")
	content.WriteString(Class("body").Render("Source") + "\n")
	content.WriteString(m.sourceInput.View() + "\n")
	content.WriteString(Class("dim").Render("Accepts a local repo directory or a git URL. Append @branch for a non-default git ref.") + "\n")
	content.WriteString(Class("dim").Render("Git sources are cloned into a managed cache before installation.") + "\n\n")
	content.WriteString(Class("body").Render("Contract") + "\n")
	content.WriteString(Class("dim").Render("The repo must export skills under external_skills/<skill>/SKILL.md.") + "\n")
	content.WriteString(Class("dim").Render("Runtime install details come from codex-tool.json, or fall back to supported repo conventions.") + "\n")
	content.WriteString(Class("dim").Render("Installed commands are added to PATH for spawned Codex sessions.") + "\n")

	if m.submitting {
		content.WriteString("\n" + Class("dim").Render("  Installing..."))
	}
	if m.err != nil {
		content.WriteString("\n\n" + Class("dialog-error").Render(" Install Failed ") + "\n")
		for _, line := range splitLines(clampLines(splitToolInstallError(m.err), 8)) {
			content.WriteString(Class("dialog-error").Render(" "+truncate(line, 84)+" ") + "\n")
		}
	}
	if m.result != "" {
		content.WriteString("\n" + Class("dialog-success").Render(" Installed: "+m.result+" "))
	}

	content.WriteString("\n" + Class("dialog-hint").Render("Enter install  |  Esc cancel"))

	dialogW := Clamp(72, max(ly.DialogWidth+18, 78), 98)
	overlay := Class("dialog").Width(dialogW).Render(content.String())
	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}
	return overlay
}

func NewToolConfigureModel(toolName string, manifest *tools.Manifest, existing map[string]string) ToolConfigureModel {
	model := ToolConfigureModel{toolName: toolName, active: true}
	if manifest != nil {
		model.description = manifest.Description
		for _, spec := range manifest.Configure.Inputs {
			input := textinput.New()
			input.Placeholder = coalesce(spec.Label, spec.Name)
			input.CharLimit = 500
			input.Width = 72
			if value := strings.TrimSpace(existing[spec.Env]); value != "" {
				input.SetValue(value)
			}
			if spec.Type == "secret" {
				input.EchoMode = textinput.EchoPassword
				input.EchoCharacter = '•'
			}
			model.fields = append(model.fields, toolConfigureField{Spec: spec, Input: input})
		}
	}
	if len(model.fields) > 0 {
		model.fields[0].Input.Focus()
	}
	return model
}

func (m ToolConfigureModel) Active() bool { return m.active }

func (m ToolConfigureModel) Init() tea.Cmd { return textinput.Blink }

func (m ToolConfigureModel) values() map[string]string {
	out := map[string]string{}
	for _, field := range m.fields {
		if env := strings.TrimSpace(field.Spec.Env); env != "" {
			out[env] = strings.TrimSpace(field.Input.Value())
		}
	}
	return out
}

func (m ToolConfigureModel) Update(msg tea.Msg) (ToolConfigureModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			m.active = false
			return m, nil
		case "tab", "down":
			if len(m.fields) > 0 {
				m.fields[m.selected].Input.Blur()
				m.selected = (m.selected + 1) % len(m.fields)
				m.fields[m.selected].Input.Focus()
			}
			return m, nil
		case "shift+tab", "up":
			if len(m.fields) > 0 {
				m.fields[m.selected].Input.Blur()
				m.selected = (m.selected - 1 + len(m.fields)) % len(m.fields)
				m.fields[m.selected].Input.Focus()
			}
			return m, nil
		case "enter":
			if m.submitting {
				return m, nil
			}
			m.submitting = true
			return m, ConfigureToolCmd(m.toolName, m.values())
		}
	case ToolConfigureCompleteMsg:
		if msg.ToolName != m.toolName {
			return m, nil
		}
		m.submitting = false
		m.err = msg.Err
		if msg.Err == nil {
			m.active = false
		}
		return m, nil
	}
	var cmds []tea.Cmd
	for i := range m.fields {
		var cmd tea.Cmd
		m.fields[i].Input, cmd = m.fields[i].Input.Update(msg)
		cmds = append(cmds, cmd)
	}
	return m, tea.Batch(cmds...)
}

func (m ToolConfigureModel) View() string {
	if !m.active {
		return ""
	}
	ly := NewLayout(m.width, m.height)
	var content strings.Builder
	content.WriteString(Class("dialog-title").Render("  Configure Plugin") + "\n\n")
	content.WriteString(Class("body").Render(m.toolName) + "\n")
	if m.description != "" {
		content.WriteString(Class("dim").Render(truncate(m.description, 86)) + "\n")
	}
	content.WriteString("\n")
	if len(m.fields) == 0 {
		content.WriteString(Class("dim").Render("This plugin does not declare any configurable inputs.") + "\n")
	} else {
		for i, field := range m.fields {
			label := coalesce(field.Spec.Label, field.Spec.Name)
			if field.Spec.Required {
				label += " *"
			}
			content.WriteString(Class("body").Render(label) + "\n")
			content.WriteString(field.Input.View() + "\n")
			if field.Spec.Env != "" {
				content.WriteString(Class("dim").Render("env "+field.Spec.Env) + "\n")
			}
			if field.Spec.Description != "" {
				content.WriteString(Class("dim").Render(truncate(field.Spec.Description, 86)) + "\n")
			}
			if i < len(m.fields)-1 {
				content.WriteString("\n")
			}
		}
	}
	if m.submitting {
		content.WriteString("\n" + Class("dim").Render("  Saving configuration..."))
	}
	if m.err != nil {
		content.WriteString("\n\n" + Class("dialog-error").Render(" Save Failed ") + "\n")
		content.WriteString(Class("dialog-error").Render(" "+truncate(m.err.Error(), 84)+" ") + "\n")
	}
	content.WriteString("\n" + Class("dialog-hint").Render("Tab next  |  Enter save  |  Esc cancel"))
	dialogW := Clamp(76, max(ly.DialogWidth+20, 84), 104)
	overlay := Class("dialog").Width(dialogW).Render(content.String())
	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}
	return overlay
}

func RenderTools(m *ToolsModel, width, height int) string {
	if m == nil {
		return Class("dim").Render("no tool manager available")
	}

	defer func() {
		if recover() != nil {
		}
	}()

	return renderToolsSafe(m, width, height)
}

func renderToolsSafe(m *ToolsModel, width, height int) string {
	if width <= 0 || height <= 0 {
		return ""
	}

	listW := Clamp(28, width/3, 38)
	detailW := width - listW - 2
	if detailW < 30 {
		detailW = 30
		listW = max(24, width-detailW-2)
	}

	panelH := height - 3
	if panelH < 10 {
		panelH = 10
	}

	titleLeft := Class("section-title").Render("  Tool Dock")
	total := len(m.Entries)
	healthy := countHealthyTools(m.Entries)
	catalogCount := len(m.VisibleCatalog())
	leftPill := Pill(fmt.Sprintf(" %d tools ", total), Cyan, BadgeCyanBg)
	rightPill := Pill(fmt.Sprintf(" %d healthy ", healthy), Green, BadgeGreenBg)
	contractPill := Pill(" external_skills ", Purple, BadgePurpleBg)
	catalogPill := Pill(fmt.Sprintf(" %d catalog ", catalogCount), Amber, BadgeAmberBg)
	titleRight := leftPill + "  " + rightPill + "  " + catalogPill + "  " + contractPill
	gap := width - lipgloss.Width(titleLeft) - lipgloss.Width(titleRight) - 2
	if gap < 1 {
		gap = 1
	}

	var b strings.Builder
	b.WriteString(titleLeft + repeatStr(" ", gap) + titleRight + "\n")
	b.WriteString(HLine(width, Muted) + "\n")

	left := renderToolsListPanel(m, listW, panelH, true)
	right := renderToolsDetailPanel(m, detailW, panelH, false)
	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, left, "  ", right))
	b.WriteString("\n")

	switch {
	case m.Error != "":
		b.WriteString(Class("dialog-error").Render(" " + m.Error))
	case m.CatalogError != "":
		b.WriteString(Class("dim").Render(" catalog: " + truncate(m.CatalogError, width-10)))
	case m.Message != "":
		b.WriteString(Class("dim").Render(" " + m.Message))
	case m.Loading:
		b.WriteString(Class("dim").Render(" loading tools..."))
	}

	return b.String()
}

func renderToolsListPanel(m *ToolsModel, w, h int, focused bool) string {
	lines := []string{
		Class("badge-cyan").Render(" installed "),
		"",
	}
	if len(m.Entries) == 0 {
		lines = append(lines, Class("dim").Render("No tools installed."), "")
	} else {
		for i, entry := range m.Entries {
			if len(lines) >= h-6 {
				break
			}
			indicator := "  "
			style := lipgloss.NewStyle().Foreground(SubText)
			if i == m.Selected {
				indicator = "▸ "
				style = lipgloss.NewStyle().Foreground(White).Bold(true)
			} else if i == m.Hovered {
				indicator = "◦ "
				style = lipgloss.NewStyle().Foreground(Cyan)
			}
			lines = append(lines, style.Render(indicator+truncate(entry.Record.Name, w-14)+toolHealthPill(entry)))
		}
	}
	lines = append(lines, "", Class("badge-amber").Render(" available catalog "), "")
	visibleCatalog := m.VisibleCatalog()
	if len(visibleCatalog) == 0 {
		lines = append(lines, Class("dim").Render("All catalog plugins already installed."), "")
	}
	for i, entry := range visibleCatalog {
		if len(lines) >= h-2 {
			break
		}
		combinedIdx := len(m.Entries) + i
		indicator := "  "
		style := lipgloss.NewStyle().Foreground(SubText)
		if combinedIdx == m.Selected {
			indicator = "▸ "
			style = lipgloss.NewStyle().Foreground(White).Bold(true)
		} else if combinedIdx == m.Hovered {
			indicator = "◦ "
			style = lipgloss.NewStyle().Foreground(Amber)
		}
		skillSuffix := ""
		if len(entry.Skills) > 0 {
			skillSuffix = fmt.Sprintf(" %d", len(entry.Skills))
		}
		lines = append(lines, style.Render(indicator+truncate(entry.Name, w-10-len(skillSuffix))+skillSuffix))
	}
	lines = append(lines, "", Class("dim").Render("j/k select  i install  c configure  u custom source  r refresh"))
	return renderWorkspacePanelBox("◈ Tools", clampLines(lines, h), w, h, focused)
}

func renderToolsDetailPanel(m *ToolsModel, w, h int, focused bool) string {
	entry := m.Current()
	if entry == nil && m.CurrentCatalog() == nil {
		lines := []string{
			Class("badge-cyan").Render(" empty "),
			"",
			Class("dim").Render("Select an installed tool or a catalog item."),
			"",
			Class("dim").Render("Available actions: i install, s sync, d doctor, r refresh."),
		}
		return renderWorkspacePanelBox("✦ Details", clampLines(lines, h), w, h, focused)
	}
	if catalog := m.CurrentCatalog(); catalog != nil {
		lines := []string{
			Class("badge-amber").Render(" " + catalog.Name + " "),
			"",
			Class("body").Render("repo    " + truncate(catalog.RepoURL, w-10)),
			Class("body").Render("ref     " + coalesce(catalog.DefaultRef, "default branch")),
			Class("body").Render("kind    " + coalesce(catalog.Kind, "tool")),
			Class("body").Render("tags    " + coalesce(strings.Join(catalog.Tags, ", "), "-")),
			Class("body").Render("type    " + coalesce(catalog.InstallType, "unknown")),
			Class("body").Render("command " + coalesce(catalog.Command, "-")),
			"",
		}
		if catalog.Description != "" {
			lines = append(lines, Class("body").Render(truncate(catalog.Description, w-2)), "")
		}
		lines = append(lines, Class("section-title").Render("  Exported Skills"), "")
		if len(catalog.Skills) == 0 {
			lines = append(lines, Class("dim").Render("No exported skills discovered."))
		} else {
			for _, skill := range catalog.Skills {
				lines = append(lines, Class("body").Render("• "+skill))
			}
		}
		if len(catalog.Provides) > 0 {
			lines = append(lines, "", Class("section-title").Render("  Provides"), "")
			for _, capability := range catalog.Provides {
				lines = append(lines, Class("body").Render("• "+capability))
			}
		}
		lines = append(lines, "", Class("section-title").Render("  Actions"), "", Class("body").Render("i  install selected catalog tool"), Class("body").Render("u  open manual source dialog"), Class("body").Render("r  refresh catalog"))
		return renderWorkspacePanelBox("✦ Catalog Item", clampLines(lines, h), w, h, focused)
	}

	record := entry.Record
	lines := []string{
		Class("badge-cyan").Render(" "+record.Name+" ") + " " + toolHealthPill(*entry),
		"",
		Class("body").Render("kind    " + coalesce(record.Kind, "tool")),
		Class("body").Render("tags    " + coalesce(strings.Join(record.Tags, ", "), "-")),
		Class("body").Render("source  " + truncate(record.SourcePath, w-10)),
		Class("body").Render("install " + truncate(record.InstallDir, w-10)),
		Class("body").Render("command " + truncate(record.CommandPath, w-10)),
		Class("body").Render("skills  " + fmt.Sprintf("%d imported", len(record.SkillPaths))),
		Class("dim").Render("installed " + record.InstalledAt),
		"",
	}
	if catalog := m.CatalogMatch(record.Name); catalog != nil {
		lines = append(lines,
			Class("badge-amber").Render(" catalog matched "),
			Class("dim").Render("catalog source "+truncate(catalog.RepoURL, w-16)),
			"",
		)
	}
	if !m.LoadedAt.IsZero() {
		lines = append(lines, Class("dim").Render("updated   "+m.LoadedAt.Format(time.RFC3339)))
		lines = append(lines, "")
	}

	if entry.Doctor != nil {
		lines = append(lines, Class("section-title").Render("  Health"), "")
		if entry.Doctor.Healthy {
			lines = append(lines, Class("dim").Render("healthy"))
		} else {
			lines = append(lines, Class("dialog-error").Render("needs attention"))
		}
		for _, check := range entry.Doctor.Checks {
			lines = append(lines, Class("faint").Render("• "+truncate(check, w-6)))
		}
		if len(entry.Doctor.Issues) > 0 {
			lines = append(lines, "")
			for _, issue := range entry.Doctor.Issues {
				lines = append(lines, Class("dialog-error").Render("! "+truncate(issue, w-6)))
			}
		}
		lines = append(lines, "")
	}

	if entry.Inspection != nil {
		if len(record.Provides) > 0 {
			lines = append(lines, Class("section-title").Render("  Provides"), "")
			for _, capability := range record.Provides {
				lines = append(lines, Class("body").Render("• "+capability))
			}
			lines = append(lines, "")
		}
		if len(record.Requires) > 0 {
			lines = append(lines, Class("section-title").Render("  Requires"), "")
			for _, capability := range record.Requires {
				label := capability.Name
				if capability.Required {
					label += "  (required)"
				}
				lines = append(lines, Class("body").Render("• "+label))
			}
			lines = append(lines, "")
		}
		if len(entry.Inspection.Manifest.Configure.Inputs) > 0 {
			lines = append(lines, Class("section-title").Render("  Configure"), "")
			for _, input := range entry.Inspection.Manifest.Configure.Inputs {
				label := coalesce(input.Label, input.Name)
				if input.Required {
					label += "  (required)"
				}
				lines = append(lines, Class("body").Render("• "+label))
				if strings.TrimSpace(input.Env) != "" {
					lines = append(lines, Class("dim").Render("  env "+input.Env))
				}
			}
			lines = append(lines, "")
		}
		if len(entry.Inspection.Manifest.Tests) > 0 {
			lines = append(lines, Class("section-title").Render("  Tests"), "")
			testResults := map[string]tools.PluginTestResult{}
			if entry.Doctor != nil {
				for _, test := range entry.Doctor.Tests {
					testResults[test.Name] = test
				}
			}
			for _, test := range entry.Inspection.Manifest.Tests {
				label := coalesce(test.Name, coalesce(test.Capability, test.Env))
				line := "• " + label + "  [" + coalesce(test.Type, "unknown") + "]"
				if result, ok := testResults[label]; ok {
					if result.Healthy {
						lines = append(lines, Class("body").Render(line+"  PASS"))
						if result.Detail != "" {
							lines = append(lines, Class("dim").Render("  "+truncate(result.Detail, w-6)))
						}
					} else {
						lines = append(lines, Class("dialog-error").Render("! "+line+"  FAIL"))
						if result.Detail != "" {
							lines = append(lines, Class("dim").Render("  "+truncate(result.Detail, w-6)))
						}
					}
					continue
				}
				lines = append(lines, Class("body").Render(line))
			}
			lines = append(lines, "")
		}
		lines = append(lines, Class("section-title").Render("  Skills"), "")
		if len(entry.Inspection.SkillSpecs) == 0 {
			lines = append(lines, Class("dim").Render("No exported skills found."))
		}
		for _, spec := range entry.Inspection.SkillSpecs {
			lines = append(lines, Class("body").Render("• "+spec.Name))
			lines = append(lines, Class("dim").Render("  src "+truncate(spec.SourcePath, w-8)))
			lines = append(lines, Class("dim").Render("  dst "+truncate(spec.DestPath, w-8)))
			preview := entry.Inspection.Previews[spec.Name]
			for _, line := range preview {
				lines = append(lines, Class("faint").Render("    "+truncate(line, w-12)))
			}
			lines = append(lines, "")
		}
	} else {
		lines = append(lines,
			Class("section-title").Render("  Skills"),
			"",
			Class("dim").Render("No managed skill preview available for this tool."),
		)
	}

	lines = append(lines,
		Class("section-title").Render("  Actions"),
		"",
		Class("body").Render("i  install / reinstall"),
		Class("body").Render("c  configure plugin"),
		Class("body").Render("s  sync skills"),
		Class("body").Render("d  doctor"),
		Class("body").Render("t  run tests"),
		Class("body").Render("r  refresh"),
		Class("body").Render("enter context menu"),
	)

	return renderWorkspacePanelBox("✦ Details", clampLines(lines, h), w, h, focused)
}

func toolHealthPill(entry ToolEntry) string {
	if entry.Doctor != nil {
		if entry.Doctor.Healthy {
			return Pill(" healthy ", Green, BadgeGreenBg)
		}
		return Pill(" needs attention ", Rose, BadgeRoseBg)
	}
	if entry.Record.Kind == "auth-provider" {
		if len(entry.Record.SkillPaths) == 0 {
			return Pill(" skills pending ", Amber, BadgeAmberBg)
		}
		return Pill(" provider ", Purple, BadgePurpleBg)
	}
	if entry.Record.CommandPath == "" {
		return Pill(" missing command ", Amber, BadgeAmberBg)
	}
	if len(entry.Record.SkillPaths) == 0 {
		return Pill(" skills pending ", Amber, BadgeAmberBg)
	}
	return Pill(" installed ", Cyan, BadgeCyanBg)
}

func countHealthyTools(entries []ToolEntry) int {
	healthy := 0
	for _, entry := range entries {
		if entry.Doctor != nil && entry.Doctor.Healthy {
			healthy++
			continue
		}
		if entry.Record.CommandPath != "" && len(entry.Record.SkillPaths) > 0 {
			healthy++
		}
	}
	return healthy
}

func splitToolInstallError(err error) []string {
	if err == nil {
		return nil
	}
	msg := strings.TrimSpace(err.Error())
	lines := splitLines(msg)
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, "[notice]") {
			continue
		}
		out = append(out, line)
	}
	if strings.Contains(msg, "requires-python") || strings.Contains(msg, "requires a different Python") {
		return []string{
			"Tool requires a newer Python than the existing install used.",
			"The importer now recreates the venv on reinstall.",
			"Run install again and it should rebuild with the compatible interpreter on PATH.",
		}
	}
	if strings.Contains(msg, "failed to read external skills") || strings.Contains(msg, "no skills found under") {
		return []string{
			"Runtime install completed, but this repo/ref does not export any external skills.",
			"Push external_skills/ to the imported branch, or import from a local checkout that has them.",
			"Git sources can target a branch or ref using: <git-url>@<branch>",
		}
	}
	if strings.Contains(msg, "Unauthenticated") {
		return []string{
			"GitLab catalog refresh is unauthenticated.",
			"Log in with glab auth login to browse repo-backed tools from the catalog.",
			"Local repo installs still work without catalog access.",
		}
	}
	if strings.Contains(msg, "no GitLab auth provider configured") {
		return []string{
			"GitLab catalog is unavailable because no GitLab auth provider is configured.",
			"Set GITLAB_TOKEN, GITLAB_PRIVATE_TOKEN, or run glab auth login.",
			"Local repo installs still work without catalog access.",
		}
	}
	if len(out) == 0 {
		return []string{msg}
	}
	return out
}
