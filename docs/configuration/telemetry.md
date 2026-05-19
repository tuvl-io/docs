# Observability (OpenTelemetry)

tuvl emits OpenTelemetry (OTel) spans for every workflow step, giving you distributed
traces across your entire workflow graph in any OTLP-compatible collector.

!!! note "Production only"
    Span export is disabled in `tuvl dev` mode regardless of configuration. Spans
    are only emitted when the engine is started with `tuvl run`.

---

## What is traced

A span is created for each workflow step execution with the following attributes:

| Attribute | Value |
|-----------|-------|
| Span name | `workflow.<workflow_name>.<step_id>` |
| `workflow.name` | Workflow `metadata.name` |
| `workflow.step_id` | Step `id` field |
| `workflow.step_kind` | Step kind (e.g. `agent`, `functional`, `router`) |
| `workflow.signal` | Routing signal emitted by the step |
| `workflow.duration_ms` | Wall-clock duration in milliseconds |
| `service.name` | Configured service name (default: `tuvl`) |

Sensitive context values are **automatically masked** before they reach the span. Any
field registered in `SECURE_FIELDS` (e.g. `password`, `token`, `api_key`) is replaced
with `***REDACTED***`.

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
| `TUVL_TELEMETRY_ENABLED` | `true` | Set to `false` to disable span export |
| `TUVL_OTLP_ENDPOINT` | `http://localhost:4317` | gRPC OTLP collector endpoint |
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

tuvl's masking layer runs before any context data is attached to a span. Fields are
identified by name (case-insensitive substring match against a built-in deny-list that
includes `password`, `token`, `secret`, `api_key`, `private_key`, and others).

Masked values appear as `***REDACTED***` in traces. The mask is applied recursively
through nested dicts and lists.

To add a project-specific field to the deny-list, extend `SECURE_FIELDS` in your
custom node code:

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
configured. All spans are no-ops (`NonRecordingSpan`).
