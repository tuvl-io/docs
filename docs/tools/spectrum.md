# Spectrum — Workflow Debugging

Spectrum is tuvl's built-in debugging and observability tool. It lets you test nodes in
isolation or trace a complete workflow execution, capturing the context at every step.

Spectrum is only available in **dev mode** (`tuvl dev`). All endpoints are under `/dev/inspect/`.

---

## Lens — Single Node Testing

The **Lens** probe runs a single registered node against a given input context and returns
the output context, execution time, and any error.

### Endpoint

```http
POST /dev/inspect/lens
```

### Request

```json
{
  "node": "save_contact",
  "context": {
    "email": "jane@example.com",
    "name": "Jane Doe"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `node` | string | Name of the registered node to run |
| `context` | object | Input context dict passed to the node |

### Response

```json
{
  "node": "save_contact",
  "input": {
    "email": "jane@example.com",
    "name": "Jane Doe"
  },
  "output": {
    "email": "jane@example.com",
    "name": "Jane Doe",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "saved"
  },
  "duration_ms": 12.4,
  "error": null
}
```

If the node raises an exception:

```json
{
  "node": "save_contact",
  "input": { ... },
  "output": null,
  "duration_ms": 0.8,
  "error": "IntegrityError: duplicate key value violates unique constraint"
}
```

### cURL Example

```bash
curl -X POST http://localhost:8000/dev/inspect/lens \
  -H "Authorization: Bearer <dev_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "node": "validate_email",
    "context": {"email": "not-an-email"}
  }'
```

---

## Spectrum — Full Workflow Trace

The **Spectrum** tracer runs a complete workflow and returns a step-by-step trace: the
context before and after each step, routing decisions, durations, and errors.

### Endpoint

```http
POST /dev/inspect/spectrum
```

### Request

```json
{
  "workflow": "candidate_onboarding",
  "context": {
    "email": "jane@example.com",
    "name": "Jane Doe",
    "experience_years": 5
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `workflow` | string | Name of the workflow (matches `metadata.name` in YAML) |
| `context` | object | Initial context dict for the workflow |

### Response

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
      "input_context": { ... },
      "output_context": {
        "priority": "senior",
        "_route": "fast_track"
      },
      "route_taken": "fast_track",
      "duration_ms": 312.7,
      "error": null
    },
    {
      "step_id": "fast_track",
      "kind": "functional",
      "runner": "send_fast_track_email",
      "input_context": { ... },
      "output_context": { ... },
      "route_taken": null,
      "duration_ms": 15.2,
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

The **Spectrum** page in the tuvl UI provides a visual representation of the trace:

- Each step is shown as a node on a flow graph with colour-coded status (success / error)
- Select any step to inspect its input/output context diff in a side panel
- The total duration and final context are shown in a summary header
- Traces can be triggered interactively with custom input contexts

Navigate to **Spectrum** in the sidebar to open the Spectrum view.

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
