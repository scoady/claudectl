package api

import "net/url"

// Widget mirrors WidgetState.
type Widget struct {
	ID         string `json:"id"`
	Project    string `json:"project"`
	Title      string `json:"title"`
	Tab        string `json:"tab"`
	TemplateID string `json:"template_id,omitempty"`
	GSX        *int   `json:"gs_x,omitempty"`
	GSY        *int   `json:"gs_y,omitempty"`
	GSW        int    `json:"gs_w"`
	GSH        int    `json:"gs_h"`
	CreatedAt  string `json:"created_at,omitempty"`
	UpdatedAt  string `json:"updated_at,omitempty"`
}

// LayoutItem represents a widget's position in a layout save request.
type LayoutItem struct {
	ID  string `json:"id"`
	X   int    `json:"x"`
	Y   int    `json:"y"`
	W   int    `json:"w"`
	H   int    `json:"h"`
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
