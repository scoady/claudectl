package tui

// EditorLanguage identifies the language the editor should render.
type EditorLanguage struct {
	ID   string
	Name string
}

// EditorHighlightRequest carries the buffer state to a highlighter.
type EditorHighlightRequest struct {
	Path    string
	Content string
	Width   int
	Theme   string
}

// EditorHighlightResult is the renderer-facing highlight payload.
type EditorHighlightResult struct {
	Language EditorLanguage
	ANSI     string
	Plain    []string
}

// EditorLanguageDetector resolves the active language from file context.
type EditorLanguageDetector interface {
	Detect(path, content string) EditorLanguage
}

// EditorHighlighter turns editor content into a styled render payload.
type EditorHighlighter interface {
	ID() string
	Highlight(req EditorHighlightRequest) (EditorHighlightResult, error)
}

// EditorCapabilityProvider allows future tool/plugin integrations to provide
// editor services without wiring language-specific logic into the workspace.
type EditorCapabilityProvider interface {
	LanguageDetector() EditorLanguageDetector
	Highlighter() EditorHighlighter
}
