package telemetry

import (
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

// HTTPMiddleware wraps an http.Handler with OpenTelemetry tracing.
// Each incoming request gets a span named after the HTTP method and route.
func HTTPMiddleware(next http.Handler) http.Handler {
	return otelhttp.NewHandler(next, "claudectl",
		otelhttp.WithMessageEvents(otelhttp.ReadEvents, otelhttp.WriteEvents),
	)
}
