package telemetry

import (
	"context"
	"log"
	"os"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	otellog "go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
	noop "go.opentelemetry.io/otel/log/noop"
	"go.opentelemetry.io/otel/metric"
	metricnoop "go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	tracenoop "go.opentelemetry.io/otel/trace/noop"
)

// Version can be set at build time via ldflags.
var Version = "2.0.1"

// Telemetry holds the initialized providers.
type Telemetry struct {
	TracerProvider trace.TracerProvider
	MeterProvider  metric.MeterProvider
	LoggerProvider otellog.LoggerProvider

	shutdowns []func(context.Context) error
}

// Init initializes OpenTelemetry providers. When OTEL_ENABLED is not "true",
// noop providers are returned for zero-overhead local development.
func Init() (*Telemetry, error) {
	t := &Telemetry{}

	enabled := strings.EqualFold(os.Getenv("OTEL_ENABLED"), "true")
	if !enabled {
		t.TracerProvider = tracenoop.NewTracerProvider()
		t.MeterProvider = metricnoop.NewMeterProvider()
		t.LoggerProvider = noop.NewLoggerProvider()
		otel.SetTracerProvider(t.TracerProvider)
		otel.SetMeterProvider(t.MeterProvider)
		global.SetLoggerProvider(t.LoggerProvider)
		log.Println("[telemetry] OTEL_ENABLED!=true — using noop providers")
		return t, nil
	}

	ctx := context.Background()

	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "localhost:4317"
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("codexctl"),
			semconv.ServiceVersionKey.String(Version),
		),
	)
	if err != nil {
		return nil, err
	}

	// Trace provider
	traceExp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExp),
		sdktrace.WithResource(res),
	)
	t.TracerProvider = tp
	t.shutdowns = append(t.shutdowns, tp.Shutdown)
	otel.SetTracerProvider(tp)

	// Propagation
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Meter provider
	metricExp, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(endpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp)),
		sdkmetric.WithResource(res),
	)
	t.MeterProvider = mp
	t.shutdowns = append(t.shutdowns, mp.Shutdown)
	otel.SetMeterProvider(mp)

	// Logger provider
	logExp, err := otlploggrpc.New(ctx,
		otlploggrpc.WithEndpoint(endpoint),
		otlploggrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}
	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
		sdklog.WithResource(res),
	)
	t.LoggerProvider = lp
	t.shutdowns = append(t.shutdowns, lp.Shutdown)
	global.SetLoggerProvider(lp)

	log.Printf("[telemetry] initialized — exporting to %s", endpoint)
	return t, nil
}

// Shutdown gracefully flushes and shuts down all providers.
func (t *Telemetry) Shutdown(ctx context.Context) {
	for _, fn := range t.shutdowns {
		if err := fn(ctx); err != nil {
			log.Printf("[telemetry] shutdown error: %v", err)
		}
	}
}
