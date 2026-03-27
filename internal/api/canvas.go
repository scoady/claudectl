package api

import "net/url"

// Widget mirrors WidgetState.
type Widget struct {
	ID         string                 `json:"id"`
	Project    string                 `json:"project"`
	Title      string                 `json:"title"`
	Kind       string                 `json:"kind,omitempty"`
	Tab        string                 `json:"tab"`
	TemplateID string                 `json:"template_id,omitempty"`
	HTML       string                 `json:"html,omitempty"`
	CSS        string                 `json:"css,omitempty"`
	JS         string                 `json:"js,omitempty"`
	Prompt     string                 `json:"prompt,omitempty"`
	Data       map[string]interface{} `json:"data,omitempty"`
	GSX        *int                   `json:"gs_x,omitempty"`
	GSY        *int                   `json:"gs_y,omitempty"`
	GSW        int                    `json:"gs_w"`
	GSH        int                    `json:"gs_h"`
	CreatedAt  string                 `json:"created_at,omitempty"`
	UpdatedAt  string                 `json:"updated_at,omitempty"`
}

// LayoutItem represents a widget's position in a layout save request.
type LayoutItem struct {
	ID string `json:"id"`
	X  int    `json:"x"`
	Y  int    `json:"y"`
	W  int    `json:"w"`
	H  int    `json:"h"`
}

// GetWidgets lists canvas widgets for a project.
func (c *Client) GetWidgets(project string) ([]Widget, error) {
	var out []Widget
	err := c.get("/api/canvas/"+url.PathEscape(project), &out)
	return out, err
}

// CreateWidget creates a new widget.
func (c *Client) CreateWidget(project string, w map[string]interface{}) (*Widget, error) {
	var out Widget
	err := c.post("/api/canvas/"+url.PathEscape(project)+"/widgets", w, &out)
	return &out, err
}

// UpdateWidget updates an existing widget.
func (c *Client) UpdateWidget(project, widgetID string, w map[string]interface{}) (*Widget, error) {
	var out Widget
	err := c.put("/api/canvas/"+url.PathEscape(project)+"/widgets/"+url.PathEscape(widgetID), w, &out)
	return &out, err
}

// DeleteWidget removes a widget.
func (c *Client) DeleteWidget(project, widgetID string) error {
	return c.delete("/api/canvas/" + url.PathEscape(project) + "/widgets/" + url.PathEscape(widgetID))
}

// GetCanvasTabs lists available canvas tabs for a project.
func (c *Client) GetCanvasTabs(project string) ([]string, error) {
	var out []string
	err := c.get("/api/canvas/"+url.PathEscape(project)+"/tabs", &out)
	return out, err
}

// SaveLayout saves the layout for all widgets in a project.
func (c *Client) SaveLayout(project string, items []LayoutItem) error {
	return c.put("/api/canvas/"+url.PathEscape(project)+"/layout", items, nil)
}

// ClearCanvas removes all widgets from a project canvas.
func (c *Client) ClearCanvas(project string) error {
	return c.delete("/api/canvas/" + url.PathEscape(project))
}

// ── Widget Templates (saved reusable widgets) ────────────────────────────────

// WidgetTemplate is a saved widget template.
type WidgetTemplate struct {
	Filename string `json:"filename"`
	Title    string `json:"title,omitempty"`
	HTML     string `json:"html,omitempty"`
	CSS      string `json:"css,omitempty"`
	JS       string `json:"js,omitempty"`
}

// GetWidgetTemplates lists saved widget templates.
func (c *Client) GetWidgetTemplates() ([]WidgetTemplate, error) {
	var out []WidgetTemplate
	err := c.get("/api/canvas/templates", &out)
	return out, err
}

// SaveWidgetTemplate saves a widget as a reusable template.
func (c *Client) SaveWidgetTemplate(body map[string]interface{}) error {
	return c.post("/api/canvas/templates", body, nil)
}

// ── Widget Catalog (parameterized templates) ─────────────────────────────────

// CatalogParam describes a parameter for a catalog template.
type CatalogParam struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Default     string `json:"default,omitempty"`
}

// CatalogTemplate is a parameterized widget template in the catalog.
type CatalogTemplate struct {
	TemplateID  string                 `json:"template_id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description,omitempty"`
	PreviewData map[string]interface{} `json:"preview_data,omitempty"`
	Parameters  []CatalogParam         `json:"parameters,omitempty"`
}

// GetCatalogTemplates lists all catalog templates.
func (c *Client) GetCatalogTemplates() ([]CatalogTemplate, error) {
	var out []CatalogTemplate
	err := c.get("/api/widget-catalog", &out)
	return out, err
}

// GetCatalogTemplate gets a single catalog template by ID.
func (c *Client) GetCatalogTemplate(id string) (*CatalogTemplate, error) {
	var out CatalogTemplate
	err := c.get("/api/widget-catalog/"+url.PathEscape(id), &out)
	return &out, err
}

// DeleteCatalogTemplate removes a catalog template.
func (c *Client) DeleteCatalogTemplate(id string) error {
	return c.delete("/api/widget-catalog/" + url.PathEscape(id))
}

// ── Dashboard Contract ───────────────────────────────────────────────────────

// ContractWidget describes the schema for a widget in the dashboard contract.
type ContractWidget struct {
	ID     string                 `json:"id"`
	Title  string                 `json:"title"`
	Schema map[string]interface{} `json:"schema,omitempty"`
}

// DashboardContract is the data contract/schema for widgets.
type DashboardContract struct {
	Widgets []ContractWidget `json:"widgets"`
}

// GetDashboardContract gets the dashboard data contract for a project.
func (c *Client) GetDashboardContract(project string) (*DashboardContract, error) {
	var out DashboardContract
	err := c.get("/api/canvas/"+url.PathEscape(project)+"/contract", &out)
	return &out, err
}

// ── Canvas Scene ─────────────────────────────────────────────────────────────

// SeedCanvas seeds the canvas with default widgets.
func (c *Client) SeedCanvas(project string) error {
	return c.post("/api/canvas/"+url.PathEscape(project)+"/seed", nil, nil)
}

// ReplaceScene atomically replaces the entire canvas.
func (c *Client) ReplaceScene(project string, widgets interface{}) error {
	return c.post("/api/canvas/"+url.PathEscape(project)+"/scene", widgets, nil)
}
