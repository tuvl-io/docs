# Observability

tuvl ships a two-pillar observability stack: **structured JSON logging** (structlog) and
**distributed tracing** (OpenTelemetry). Both pillars are correlated — every log line
automatically carries the current `trace_id` and `span_id` so you can jump from a log
event straight to the trace in Jaeger or Grafana Tempo.

!!! note "Production only"
    Span export and HTTP-level tracing are disabled in `tuvl dev` mode. Use `tuvl run`
    to activate the full telemetry pipeline.

---

## Structured Logging

tuvl uses **structlog 25.5.0** for all internal logging. In production every log line
is a single JSON object written to stdout; in development a human-friendly coloured
renderer is used instead.

### Log format

Production (`TUVL_ENV` ≠ `development`):

```json
{
  "event": "Agent LLM response",
  "level": "info",
  "timestamp": "2025-08-01T12:00:00.123456Z",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id":  "00f067aa0ba902b7",
  "step_id": "classify",
  "model": "ollama/llama3",
  "input_tokens": 312,
  "output_tokens": 47
}
```

Development (`TUVL_ENV=development`): human-readable coloured output via structlog's
`ConsoleRenderer`.

### Controlling the renderer

| Variable | Default | Description |
|----------|---------|-------------|
| `TUVL_ENV` | `""` | Set to `development` for the coloured console renderer |

### OTel correlation

The `inject_otel_context` structlog processor injects `trace_id` and `span_id` from
the active OpenTelemetry span into every log record. Any log line emitted inside a
`workflow.execute` or `node.<kind>` span automatically carries both identifiers — no
extra instrumentation needed.

### Standard library bridge

Python's `logging` module is bridged via `structlog.stdlib.ProcessorFormatter` so that
third-party libraries that use `logging.getLogger(...)` also produce correlated JSON
log lines.

### Emitting structured logs from custom nodes

```python
import structlog

log = structlog.get_logger(__name__)

class MyRunner:
    async def run(self, context):
        log.info("processing request", step_id=self.cfg["id"], items=len(context["items"]))
        ...
```

---

## Distributed Tracing (OpenTelemetry)

tuvl emits OTel spans for every workflow execution and every node step. Spans are
exported over gRPC (OTLP) to any compatible collector.

### Span hierarchy

Each workflow invocation produces a **parent span** containing one **child span per
node**:

```
workflow.execute          (parent)
├── node.agent            (child — agent step)
├── node.functional       (child — functional step)
├── node.router           (child — router step)
└── node.HumanInTheLoop   (child — HITL step)
```

Valid node kinds: `functional`, `agent`, `api_call`, `mcp`, `router`, `model-op`,
`response`, `HumanInTheLoop`.

### Span attributes

**Parent span** (`workflow.execute`):

| Attribute | Value |
|-----------|-------|
| `tuvl.workflow.name` | `metadata.name` from the workflow YAML |

**Child spans** (`node.<kind>`):

| Attribute | Value |
|-----------|-------|
| `tuvl.node.id` | Step `id` field |
| `tuvl.node.kind` | Step kind |
| `tuvl.step.signal` | Routing signal emitted by the step |
| `tuvl.step.duration_ms` | Wall-clock duration in milliseconds |
| `tuvl.context.snapshot` | JSON-serialised workflow context (secure fields masked) |

Secure field values appear as `"*****"` in the context snapshot. The set of secure
fields is populated from every model field with `secure: true` in its
[ModelDefinition YAML](../concepts/models.md#field-options). See
[Data Masking](#data-masking) for details.

### HTTP / W3C traceparent

FastAPI is instrumented with `FastAPIInstrumentor` (production mode only). Incoming
requests that carry a `traceparent` header (W3C Trace Context) are automatically
linked as children of the upstream trace — enabling end-to-end context propagation
from your gateway or frontend to the workflow engine.

### LiteLLM GenAI telemetry

tuvl registers LiteLLM's built-in OpenTelemetry callback at startup:

```python
litellm.callbacks = ["opentelemetry"]
```

This emits `gen_ai.*` semantic-convention spans for every LLM call, giving you
per-model latency, token usage, and error rates in the same trace as the workflow
spans.

---

## Configuration

tuvl resolves telemetry config in this order (first wins):

1. **Environment variables** — always take precedence
2. **`.tuvl/telemetry.yaml`** — written by the Dev UI Settings → Telemetry panel
3. **Compiled-in defaults** — `enabled=true`, endpoint `localhost:4317`, service `tuvl`

### Config file

The file lives at `<project>/.tuvl/telemetry.yaml` and uses the standard tuvl
`kind/version/metadata/spec` envelope:

```yaml title=".tuvl/telemetry.yaml"
kind: TelemetryConfig
version: v1
metadata:
  name: default
spec:
  # Disable to suppress span export while keeping production mode active.
  enabled: true

  # gRPC endpoint of your OTLP collector.
  # Common values:
  #   Jaeger all-in-one:     http://localhost:4317
  #   Grafana Tempo:         http://localhost:4317
  #   OpenTelemetry Collector: http://localhost:4317
  otlp_endpoint: http://localhost:4317

  # Attached to every span as service.name.
  service_name: tuvl
```

`tuvl init --sample` writes this file automatically.

### Environment variables

Environment variables override the config file at runtime — no restart needed for
temporary changes:

| Variable | Default | Description |
|----------|---------|-------------|
| `TUVL_ENV` | `""` | `development` enables console log renderer; any other value uses JSON |
| `TUVL_TELEMETRY_ENABLED` | `true` | Set to `false` to disable span export |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Standard OTel env var; takes precedence over `TUVL_OTLP_ENDPOINT` |
| `TUVL_OTLP_ENDPOINT` | `http://localhost:4317` | gRPC OTLP collector endpoint (fallback) |
| `TUVL_SERVICE_NAME` | `tuvl` | `service.name` resource attribute on every span |

### Dev UI

The `.tuvl/telemetry.yaml` file can also be edited from the Dev UI without touching
the file directly:

**Settings → Observability → Telemetry**

The panel shows a live YAML preview and an Advanced editor. Changes are saved
immediately but take effect only after restarting the engine with `tuvl run`.

---

## Collector Setup

### Jaeger (local development)

The quickest way to visualise traces locally:

```bash
docker run -d --name jaeger \
  -p 4317:4317 \   # OTLP gRPC
  -p 16686:16686 \ # Jaeger UI
  jaegertracing/all-in-one:latest
```

Then set in `.tuvl/telemetry.yaml`:

```yaml
spec:
  otlp_endpoint: http://localhost:4317
  service_name: my-app
```

Open `http://localhost:16686` to browse traces.

### Grafana Tempo

```yaml title="docker-compose.yml (excerpt)"
services:
  tempo:
    image: grafana/tempo:latest
    ports:
      - "4317:4317"   # OTLP gRPC receiver
```

Point `otlp_endpoint` at `http://tempo:4317` inside Docker, or
`http://localhost:4317` from the host.

### OpenTelemetry Collector

For production deployments that fan out to multiple backends:

```yaml title="otelcol-config.yaml (excerpt)"
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  jaeger:
    endpoint: jaeger:14250
  prometheus:
    endpoint: 0.0.0.0:8889
```

---

## Data Masking

tuvl's masking layer runs before any context data is attached to a span. Secure fields
are identified by the `secure: true` flag on model fields defined in your project's
[ModelDefinition YAMLs](../concepts/models.md#field-options). At startup tuvl collects
every field name marked `secure: true` into the `SECURE_FIELDS` set.

Masked values appear as `"*****"` in the `tuvl.context.snapshot` span attribute. The
mask is applied recursively through nested dicts and lists.

To add a project-specific field to the secure set at runtime:

```python
from tuvl.core.core.loader import SECURE_FIELDS

SECURE_FIELDS.add("my_internal_secret")
```

---

## Disabling Telemetry

Set `enabled: false` in the config file or use the environment variable:

```bash
TUVL_TELEMETRY_ENABLED=false tuvl run
```

The engine logs `OTel: telemetry disabled` at startup and the `TracerProvider` is not
configured. All spans are no-ops (`NonRecordingSpan`). Structured logging continues to
work normally.
