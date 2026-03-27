package server

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/scoady/codexctl/internal/api"
)

type canvasScene struct {
	Widgets []api.Widget `json:"widgets"`
}

func (s *Server) handleGetCanvas(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, scene.Widgets)
}

func (s *Server) handleClearCanvas(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	scene.Widgets = nil
	if err := s.saveCanvasScene(project, scene); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
}

func (s *Server) handleCreateCanvasWidget(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	var body map[string]interface{}
	if err := readJSON(r, &body); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	widget, err := s.widgetFromBody(project, body, "")
	if err != nil {
		httpError(w, http.StatusBadRequest, err.Error())
		return
	}
	scene.Widgets = append(scene.Widgets, widget)
	if err := s.saveCanvasScene(project, scene); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, widget)
}

func (s *Server) handleUpdateCanvasWidget(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	id := r.PathValue("id")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	var body map[string]interface{}
	if err := readJSON(r, &body); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	idx := -1
	for i, widget := range scene.Widgets {
		if widget.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		httpError(w, http.StatusNotFound, "widget not found")
		return
	}
	widget, err := s.widgetFromBody(project, body, id)
	if err != nil {
		httpError(w, http.StatusBadRequest, err.Error())
		return
	}
	if widget.CreatedAt == "" {
		widget.CreatedAt = scene.Widgets[idx].CreatedAt
	}
	scene.Widgets[idx] = widget
	if err := s.saveCanvasScene(project, scene); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, widget)
}

func (s *Server) handleDeleteCanvasWidget(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	id := r.PathValue("id")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	next := make([]api.Widget, 0, len(scene.Widgets))
	found := false
	for _, widget := range scene.Widgets {
		if widget.ID == id {
			found = true
			continue
		}
		next = append(next, widget)
	}
	if !found {
		httpError(w, http.StatusNotFound, "widget not found")
		return
	}
	scene.Widgets = next
	if err := s.saveCanvasScene(project, scene); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleGetCanvasTabs(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, canvasTabs(scene.Widgets))
}

func (s *Server) handleSaveCanvasLayout(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	var items []api.LayoutItem
	if err := readJSON(r, &items); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	byID := map[string]api.LayoutItem{}
	for _, item := range items {
		byID[item.ID] = item
	}
	for i, widget := range scene.Widgets {
		if item, ok := byID[widget.ID]; ok {
			x := item.X
			y := item.Y
			scene.Widgets[i].GSX = &x
			scene.Widgets[i].GSY = &y
			scene.Widgets[i].GSW = max(1, item.W)
			scene.Widgets[i].GSH = max(1, item.H)
			scene.Widgets[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		}
	}
	if err := s.saveCanvasScene(project, scene); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (s *Server) handleGetCanvasContract(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	contract := api.DashboardContract{Widgets: make([]api.ContractWidget, 0, len(scene.Widgets))}
	for _, widget := range scene.Widgets {
		contract.Widgets = append(contract.Widgets, api.ContractWidget{
			ID:    widget.ID,
			Title: widget.Title,
			Schema: map[string]interface{}{
				"kind":        widget.Kind,
				"tab":         widget.Tab,
				"template_id": widget.TemplateID,
				"has_html":    widget.HTML != "",
				"has_css":     widget.CSS != "",
				"has_js":      widget.JS != "",
			},
		})
	}
	writeJSON(w, http.StatusOK, contract)
}

func (s *Server) handleSeedCanvas(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	scene, err := s.loadCanvasScene(project)
	if err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	if len(scene.Widgets) == 0 {
		for _, body := range defaultSeedWidgets(project) {
			widget, buildErr := s.widgetFromBody(project, body, "")
			if buildErr != nil {
				httpError(w, http.StatusInternalServerError, buildErr.Error())
				return
			}
			scene.Widgets = append(scene.Widgets, widget)
		}
		if err := s.saveCanvasScene(project, scene); err != nil {
			httpError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, scene.Widgets)
}

func (s *Server) handleReplaceCanvasScene(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	if _, err := s.loadCanvasScene(project); err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}
	var body any
	if err := readJSON(r, &body); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	var rawWidgets []map[string]interface{}
	switch typed := body.(type) {
	case []interface{}:
		for _, item := range typed {
			if m, ok := item.(map[string]interface{}); ok {
				rawWidgets = append(rawWidgets, m)
			}
		}
	case map[string]interface{}:
		if list, ok := typed["widgets"].([]interface{}); ok {
			for _, item := range list {
				if m, ok := item.(map[string]interface{}); ok {
					rawWidgets = append(rawWidgets, m)
				}
			}
		}
	}
	scene := canvasScene{Widgets: make([]api.Widget, 0, len(rawWidgets))}
	for _, raw := range rawWidgets {
		widget, err := s.widgetFromBody(project, raw, "")
		if err != nil {
			httpError(w, http.StatusBadRequest, err.Error())
			return
		}
		scene.Widgets = append(scene.Widgets, widget)
	}
	if err := s.saveCanvasScene(project, scene); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, scene.Widgets)
}

func (s *Server) handleGetCanvasTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := s.loadCanvasTemplates()
	if err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (s *Server) handleSaveCanvasTemplate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := readJSON(r, &body); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	templates, err := s.loadCanvasTemplates()
	if err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	filename := stringValue(body["filename"], stringValue(body["template_id"], "template-"+canvasID()))
	title := stringValue(body["title"], filename)
	template := api.WidgetTemplate{
		Filename: filename,
		Title:    title,
		HTML:     stringValue(body["html"], ""),
		CSS:      stringValue(body["css"], ""),
		JS:       stringValue(body["js"], ""),
	}
	replaced := false
	for i, existing := range templates {
		if existing.Filename == filename {
			templates[i] = template
			replaced = true
			break
		}
	}
	if !replaced {
		templates = append(templates, template)
	}
	if err := s.saveCanvasTemplates(templates); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, template)
}

func (s *Server) handleGetWidgetCatalog(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, builtinCanvasCatalog())
}

func (s *Server) handleGetWidgetCatalogItem(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	for _, item := range builtinCanvasCatalog() {
		if item.TemplateID == id {
			writeJSON(w, http.StatusOK, item)
			return
		}
	}
	httpError(w, http.StatusNotFound, "catalog template not found")
}

func (s *Server) handleDeleteWidgetCatalogItem(w http.ResponseWriter, r *http.Request) {
	httpError(w, http.StatusMethodNotAllowed, "built-in catalog items cannot be deleted")
}

func (s *Server) ensureCanvasProjectSpace(project string) (string, error) {
	projRoot := filepath.Join(s.ProjectsDir, project)
	if _, err := os.Stat(projRoot); err != nil {
		return "", fmt.Errorf("project not found: %s", project)
	}
	dir := filepath.Join(projRoot, ".c9s", "canvas")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	scenePath := filepath.Join(dir, "scene.json")
	if _, err := os.Stat(scenePath); os.IsNotExist(err) {
		data, marshalErr := json.MarshalIndent(canvasScene{Widgets: []api.Widget{}}, "", "  ")
		if marshalErr != nil {
			return "", marshalErr
		}
		if err := os.WriteFile(scenePath, data, 0o644); err != nil {
			return "", err
		}
	}
	return dir, nil
}

func (s *Server) loadCanvasScene(project string) (canvasScene, error) {
	dir, err := s.ensureCanvasProjectSpace(project)
	if err != nil {
		return canvasScene{}, err
	}
	data, err := os.ReadFile(filepath.Join(dir, "scene.json"))
	if err != nil {
		return canvasScene{}, err
	}
	var scene canvasScene
	if len(data) == 0 {
		return canvasScene{Widgets: []api.Widget{}}, nil
	}
	if err := json.Unmarshal(data, &scene); err != nil {
		return canvasScene{}, err
	}
	if scene.Widgets == nil {
		scene.Widgets = []api.Widget{}
	}
	return scene, nil
}

func (s *Server) saveCanvasScene(project string, scene canvasScene) error {
	dir, err := s.ensureCanvasProjectSpace(project)
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(scene, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "scene.json"), data, 0o644)
}

func (s *Server) templatesPath() string {
	return filepath.Join(s.ProjectsDir, ".c9s", "canvas", "templates.json")
}

func (s *Server) loadCanvasTemplates() ([]api.WidgetTemplate, error) {
	path := s.templatesPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return builtinCanvasTemplates(), nil
	}
	if err != nil {
		return nil, err
	}
	var templates []api.WidgetTemplate
	if err := json.Unmarshal(data, &templates); err != nil {
		return nil, err
	}
	return mergeCanvasTemplates(templates, builtinCanvasTemplates()), nil
}

func (s *Server) saveCanvasTemplates(templates []api.WidgetTemplate) error {
	path := s.templatesPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(templates, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func mergeCanvasTemplates(primary, fallback []api.WidgetTemplate) []api.WidgetTemplate {
	seen := map[string]struct{}{}
	out := make([]api.WidgetTemplate, 0, len(primary)+len(fallback))
	for _, group := range [][]api.WidgetTemplate{primary, fallback} {
		for _, template := range group {
			if template.Filename == "" {
				continue
			}
			if _, ok := seen[template.Filename]; ok {
				continue
			}
			seen[template.Filename] = struct{}{}
			out = append(out, template)
		}
	}
	return out
}

func (s *Server) widgetFromBody(project string, body map[string]interface{}, existingID string) (api.Widget, error) {
	tab := stringValue(body["tab"], "default")
	templateID := stringValue(body["template_id"], "")
	title := stringValue(body["title"], "")
	kind := stringValue(body["kind"], "html")
	html := stringValue(body["html"], "")
	css := stringValue(body["css"], "")
	js := stringValue(body["js"], "")
	prompt := stringValue(body["prompt"], "")
	data := mapValue(body["data"])

	if templateID != "" && html == "" && css == "" && js == "" {
		template := findCanvasTemplate(templateID, builtinCanvasTemplates())
		if template.Filename == "" {
			saved, _ := s.loadCanvasTemplates()
			template = findCanvasTemplate(templateID, saved)
		}
		if template.Filename != "" {
			if title == "" {
				title = template.Title
			}
			html = template.HTML
			css = template.CSS
			js = template.JS
			if kind == "" || kind == "html" {
				kind = inferWidgetKind(template.Filename)
			}
		}
	}

	if title == "" {
		title = coalesceNonEmpty(stringValue(data["title"], ""), templateID, "Canvas Widget")
	}

	x := optionalInt(body["gs_x"])
	y := optionalInt(body["gs_y"])
	w := intValue(body["gs_w"], 6)
	h := intValue(body["gs_h"], 4)
	now := time.Now().UTC().Format(time.RFC3339)
	id := existingID
	if id == "" {
		id = "widget-" + canvasID()
	}

	return api.Widget{
		ID:         id,
		Project:    project,
		Title:      title,
		Kind:       kind,
		Tab:        tab,
		TemplateID: templateID,
		HTML:       html,
		CSS:        css,
		JS:         js,
		Prompt:     prompt,
		Data:       data,
		GSX:        x,
		GSY:        y,
		GSW:        max(1, w),
		GSH:        max(1, h),
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func canvasTabs(widgets []api.Widget) []string {
	seen := map[string]struct{}{"default": {}}
	for _, widget := range widgets {
		tab := strings.TrimSpace(widget.Tab)
		if tab == "" {
			tab = "default"
		}
		seen[tab] = struct{}{}
	}
	tabs := make([]string, 0, len(seen))
	for tab := range seen {
		tabs = append(tabs, tab)
	}
	sort.Strings(tabs)
	return tabs
}

func builtinCanvasTemplates() []api.WidgetTemplate {
	return []api.WidgetTemplate{
		{
			Filename: "rich-hero",
			Title:    "Rich Hero",
			HTML:     `<section class="hero"><h1>{{title}}</h1><p>{{subtitle}}</p><div class="orb"></div></section>`,
			CSS:      `.hero{position:relative;padding:32px;border-radius:24px;background:linear-gradient(135deg,#08111d,#111827);color:#e5f3ff;overflow:hidden}.hero h1{font-size:40px;margin:0 0 8px}.hero p{opacity:.8}.orb{position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,#67e8f9,transparent 65%);filter:blur(8px);animation:float 6s ease-in-out infinite}@keyframes float{50%{transform:translateY(12px)}}`,
			JS:       ``,
		},
		{
			Filename: "pixel-scene",
			Title:    "Pixel Scene",
			HTML:     `<pre class="pixel">{{art}}</pre>`,
			CSS:      `.pixel{font:14px/14px monospace;letter-spacing:0;background:#090b12;color:#8be9fd;padding:20px;border-radius:16px}`,
			JS:       ``,
		},
		{
			Filename: "spark-board",
			Title:    "Spark Board",
			HTML:     `<div class="board"><h2>{{title}}</h2><div id="spark"></div></div>`,
			CSS:      `.board{padding:20px;border-radius:18px;background:rgba(15,23,42,.88);color:#dbeafe}#spark{height:120px;margin-top:12px}`,
			JS:       `window.renderSpark && window.renderSpark("spark", data?.values || [1,3,2,6,4,7]);`,
		},
	}
}

func builtinCanvasCatalog() []api.CatalogTemplate {
	return []api.CatalogTemplate{
		{
			TemplateID:  "rich-hero",
			Title:       "Rich Hero",
			Description: "Large animated HTML hero card for narrative summaries or demos.",
			Parameters: []api.CatalogParam{
				{Name: "title", Type: "string", Description: "Primary heading"},
				{Name: "subtitle", Type: "string", Description: "Secondary copy"},
			},
		},
		{
			TemplateID:  "pixel-scene",
			Title:       "Pixel Scene",
			Description: "Terminal-friendly pixel art or ASCII scene block.",
			Parameters: []api.CatalogParam{
				{Name: "art", Type: "string", Description: "ASCII or pixel-art content"},
			},
		},
		{
			TemplateID:  "spark-board",
			Title:       "Spark Board",
			Description: "Compact metric board with animated sparkline values.",
			Parameters: []api.CatalogParam{
				{Name: "title", Type: "string", Description: "Panel title"},
				{Name: "values", Type: "array", Description: "Sparkline values"},
			},
		},
	}
}

func defaultSeedWidgets(project string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"title":       project + " canvas",
			"tab":         "default",
			"template_id": "rich-hero",
			"kind":        "html",
			"data": map[string]interface{}{
				"title":    project,
				"subtitle": "Canvas space for generated visuals and working notes.",
			},
			"gs_x": 0, "gs_y": 0, "gs_w": 8, "gs_h": 4,
		},
		{
			"title":       "pixel sketch",
			"tab":         "default",
			"template_id": "pixel-scene",
			"kind":        "pixel",
			"data": map[string]interface{}{
				"art": " .-.\n(o o)\n| O \\\n \\   \\\n  `~~~'",
			},
			"gs_x": 8, "gs_y": 0, "gs_w": 4, "gs_h": 4,
		},
	}
}

func findCanvasTemplate(id string, templates []api.WidgetTemplate) api.WidgetTemplate {
	for _, template := range templates {
		if template.Filename == id {
			return template
		}
	}
	return api.WidgetTemplate{}
}

func inferWidgetKind(name string) string {
	switch {
	case strings.Contains(name, "pixel"):
		return "pixel"
	case strings.Contains(name, "spark"):
		return "chart"
	default:
		return "html"
	}
}

func stringValue(v interface{}, fallback string) string {
	if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
		return s
	}
	return fallback
}

func intValue(v interface{}, fallback int) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	default:
		return fallback
	}
}

func optionalInt(v interface{}) *int {
	switch n := v.(type) {
	case float64:
		x := int(n)
		return &x
	case int:
		x := n
		return &x
	default:
		return nil
	}
}

func mapValue(v interface{}) map[string]interface{} {
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	return nil
}

func canvasID() string {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err == nil {
		return strings.ToLower(fmt.Sprintf("%x%x", time.Now().UnixNano(), buf))
	}
	return strings.ToLower(fmt.Sprintf("%x", time.Now().UnixNano()))
}

func coalesceNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
