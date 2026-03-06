package server

import (
	"embed"
	"io/fs"
)

//go:embed dashboard
var dashboardFS embed.FS

// DashboardFS returns the embedded dashboard files rooted at the dist directory.
func DashboardFS() fs.FS {
	sub, err := fs.Sub(dashboardFS, "dashboard")
	if err != nil {
		panic(err)
	}
	return sub
}
