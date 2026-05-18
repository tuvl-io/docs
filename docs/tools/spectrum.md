# Spectrum — Workflow Debugging

Spectrum is tuvl's built-in debugging and observability tool. It lets you test nodes in
isolation or trace a complete workflow execution, capturing the context at every step.

Spectrum is only available in **dev mode** (`TUVL_DEV_MODE=true`). All operations are
exposed as **gRPC-Web RPCs** on `DevService` (defined in `dev.proto`) and are accessible
through the tuvl dev console UI at `/insight`.

!!! note "Transport"
    Spectrum and Lens moved from REST (`/dev/inspect/...`) to gRPC-Web in the current
    release. The dev console communicates via `@protobuf-ts/grpcweb-transport`. Raw HTTP
    access using cURL requires a gRPC-Web capable proxy or the `grpcurl` tool.

---

## Lens — Single Node Testing

The **Lens** probe runs a single registered node against a given input context and returns
the output context, execution time, and any error.

### RPC

```
DevService.RunLens (dev.proto)
```

### Request message: `LensRequest`

```proto
message LensRequest {
  string node    = 1;  // registered node name
  string context_json = 2;  // JSON-encoded input context
}
```

| Field | Type | Description |
|-------|------|-------------|
| `node` | string | Name of the registered node to run |
| `context_json` | string | JSON-encoded input context dict passed to the node |

### Response message: `LensResponse`

```proto
message LensResponse {
  string node        = 1;
  string input_json  = 2;
  string output_json = 3;
  float  duration_ms = 4;
  string error       = 5;
}
```

Example decoded response:

```json
{
  "node": "save_contact",
  "input_json": "{\"email\":\"jane@example.com\",\"name\":\"Jane Doe\"}",
  "output_json": "{\"email\":\"jane@example.com\",\"name\":\"Jane Doe\",\"id\":\"550e8400-...\",\"status\":\"saved\"}",
  "duration_ms": 12.4,
  "error": ""
}
```

If the node raises an exception the `output_json` field will be empty and `error` will
contain the exception message.

---

## Spectrum — Full Workflow Trace

The **Spectrum** tracer runs a complete workflow and returns a step-by-step trace: the
context before and after each step, routing decisions, durations, and errors.

### RPC

```
DevService.RunSpectrum (dev.proto)
```

### Request message: `SpectrumRequest`

```proto
message SpectrumRequest {
  string workflow     = 1;  // metadata.name from the workflow YAML
  string context_json = 2;  // JSON-encoded initial context
}
```

| Field | Type | Description |
|-------|------|-------------|
| `workflow` | string | Name of the workflow (matches `metadata.name` in YAML) |
| `context_json` | string | JSON-encoded initial context dict |

### Response message: `SpectrumResponse`

The response includes a full trace with per-step snapshots:

```json
{
  "workflow": "candidate_onboarding",
  "success": true,
  "total_duration_ms": 342.1,
  "steps": [
    {
      "step_id": "save_draft",
      "kind": "functional",
      "runner": "save_contact",
      "input_context": {
        "email": "jane@example.com",
        "name": "Jane Doe"
      },
      "output_context": {
        "email": "jane@example.com",
        "name": "Jane Doe",
        "id": "550e8400-e29b-41d4-a716-446655440000"
      },
      "route_taken": null,
      "duration_ms": 14.2,
      "error": null
    },
    {
      "step_id": "ai_vetting",
      "kind": "agent",
      "runner": null,
      "input_context": { "...": "..." },
      "output_context": {
        "priority": "senior",
        "_route": "fast_track"
      },
      "route_taken": "fast_track",
      "duration_ms": 312.7,
      "error": null
    }
  ],
  "final_context": {
    "email": "jane@example.com",
    "name": "Jane Doe",
    "id": "550e8400-...",
    "priority": "senior"
  },
  "error": null
}
```

### TraceStep Fields

| Field | Type | Description |
|-------|------|-------------|
| `step_id` | string | The step's `id` from the workflow YAML |
| `kind` | string | `functional`, `agent`, `router`, `api_call`, `mcp` |
| `runner` | string or null | Node name for `functional` steps |
| `input_context` | object | Context snapshot **before** the step ran |
| `output_context` | object | Context snapshot **after** the step ran |
| `route_taken` | string or null | Which route key was followed (for `router`/`agent` steps) |
| `duration_ms` | number | Wall-clock time in milliseconds |
| `error` | string or null | Exception message if the step failed |

---

## Spectrum UI

The **Spectrum** page in the tuvl dev console (`/insight`) provides a visual representation
of the trace:

- Each step is shown as a node on a flow graph with colour-coded status (success / error)
- Select any step to inspect its input/output context diff in a side panel
- The total duration and final context are shown in a summary header
- Traces can be triggered interactively with custom input contexts

Navigate to **Spectrum** in the sidebar to open the Spectrum view.

---

## Authentication

All `DevService` RPCs require the dev API key passed as gRPC metadata:

```
x-dev-key: <TUVL_DEV_API_KEY>
```

The key is set in your project's `.env` file:

```env
TUVL_DEV_API_KEY=your-secret-key
```

---

## Use Cases

| Scenario | Tool |
|----------|------|
| Test a single node without running the full workflow | Lens |
| Debug why a workflow takes the wrong route | Spectrum |
| Verify context mutations at each step | Spectrum |
| Test a node with multiple input variants | Lens (repeat calls) |
| Find which step is slow | Spectrum (check `duration_ms` per step) |
| Reproduce a production failure locally | Spectrum (copy the failing input) |

