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

## Workflow Canvas — Integrated Test Mode

In addition to the standalone Spectrum page, the **Workflow Canvas** (available under
**Workflows** in the sidebar) embeds a full streaming test runner directly inside the
visual editor.

### Using the Test Panel

1. Open any workflow in the Workflow Canvas editor.
2. Click **▶ Test** in the top-right toolbar — this switches the left panel to **Test**
   mode.
3. Fill in the **input JSON** in the CodeMirror editor.  Fields required by the
   workflow's input schema are auto-scaffolded.  Click any field chip to insert a key
   instantly.
4. Click **▶ Run** (or **⏹ Stop** to abort mid-flight).

### What happens on Run

| Area | Behaviour |
|------|-----------|
| **Canvas nodes** | Each node lights up with a colour-coded ring and a status badge as execution streams in: pulsing sky-blue (running), emerald ✓ (success), rose ✗ (error), amber ! (partial) |
| **Right panel — Test Out tab** | Opens automatically and shows a live step list streaming in from left to right. Each row shows status icon, step ID, and wall-clock duration |
| **Step inspector** | Click any step row to open the before/after context diff table with added (+), changed (~), and unchanged rows colour-coded; sub-tabs for **State**, **Logs**, and **Error** |
| **Final State** | A pinned entry at the top of the step list — click to browse every context key in the terminal state |
| **Bottom status bar** | Persists below the canvas while test results are in scope — shows overall status badge, the currently executing node ID, step progress (`N/N steps ok`), and any top-level error message |

### Input Schema Auto-Scaffold

The editor reads the workflow's `input_schema` metadata:

- If set to `context`, required fields are sourced from the context model definitions.
- If set to a model name, the model's field list is used.
- A custom JSON array of field names is also supported.

When the editor is empty and schema fields are known the scaffold fires automatically,
pre-populating every required key with an empty string so you only have to fill in values.

### Resizing panels

Both the left Test panel and the right Test Out / YAML panel are resizable — drag the
edge handle to adjust the width to suit your screen.

### Stopping a run mid-flight

Click **⏹ Stop** (replaces the Run button while running) to abort the async gRPC stream
immediately. The partial results already captured remain visible in the Test Out panel.

### Clearing results

Click **✕ Clear** in the bottom status bar to reset all test state and return the canvas
to its normal view.

---

## LLM-as-a-Judge — Evaluate Tab

Every step in the Spectrum detail panel has a fourth **Evaluate** tab. It lets you run an
LLM-as-a-Judge assertion against that step's captured trace directly from the UI — no
test YAML file required.

### How to use

1. Run a workflow trace (click **Run** in the Spectrum left panel).
2. Click any completed step node on the canvas — the detail panel opens on the right.
3. Click the **Evaluate** tab (fourth tab, after State / Logs / Error).
4. Enter an **Evaluation instruction** describing what a correct output looks like.
5. Optionally pick a **Judge model override** from the dropdown (populated from your
   configured AI Models). Leave at the default to use the model set in
   Settings → Testing → LLM Judge.
6. Click **Run Evaluation**.

The result card appears below the button:

| Verdict | Colour | Meaning |
|---------|--------|---------|
| **PASSED** | Emerald | The judge determined the step output satisfies the instruction |
| **FAILED** | Rose | The judge determined the step output does not satisfy the instruction |
| **SKIPPED** | Amber | No judge model is configured — no LLM call was made |

The **tab badge** (coloured dot on the Evaluate label in the tab strip) updates to match
the verdict so you can see the result at a glance while browsing other tabs.

Switching to a different step resets the result automatically.

### Judge model resolution

For Spectrum evaluate calls the model is resolved in the same order as `tuvl test`:

1. **Judge model override** selected in the Evaluate panel (per-call)
2. **`.tuvl/testing.yaml`** persisted config — set via Settings → Testing → LLM Judge
3. **`TUVL_TEST_JUDGE`** environment variable

If none provides a model the evaluation is skipped (amber) without making any LLM API call.

### gRPC RPCs

The Evaluate tab calls two new `DevService` RPCs:

```proto
rpc GetTestingConfig  (DevEmpty)             returns (TestingConfigResponse);
rpc SaveTestingConfig (SaveTestingConfigReq) returns (DevMutateResult);
rpc EvaluateTrace     (EvaluateTraceReq)     returns (EvaluateTraceResponse);
```

```proto
message EvaluateTraceReq {
  string step_trace_json = 1;  // JSON-serialised step trace dict
  string step_id         = 2;
  string instruction     = 3;
  string judge_model     = 4;  // optional override
}

message EvaluateTraceResponse {
  bool   passed     = 1;
  string reason     = 2;
  string model_used = 3;
  bool   skipped    = 4;
}
```

A REST-compatible shim is also available for tooling that cannot use gRPC-Web:

```
POST /dev/evaluate-trace
```

```json
{
  "step_id": "compute_score",
  "instruction": "The score must be between 0 and 100.",
  "step_trace": { "input_snapshot": {}, "output_snapshot": { "score": 72 } },
  "judge_model": "openai/gpt-4o-mini"
}
```

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

## Testing Human-in-the-Loop Nodes with Lens

`HumanInTheLoop` steps cannot complete in a single synchronous pass — they pause and
wait for a reviewer. Lens handles this gracefully: instead of raising an error, it returns
a **`suspended`** result so you can inspect exactly what payload would be sent to the
human reviewer.

### How it works

1. Open Lens on a `HumanInTheLoop` node from the workflow canvas.
2. Fill the **Mock Input** panel with the context keys your `display_context` list
   references (plus any keys used in `ui.title`/`ui.instruction` interpolation).
3. Click **Execute** — the engine hits the HITL branch, suspends, and Lens intercepts
   the `SuspendWorkflowException`.
4. The **Suspended** tab opens automatically, showing the full `hitl_request` payload
   broken down into:

| Section | Contents |
|---------|----------|
| **Review UI** | `title` and `instruction` after Jinja-style interpolation |
| **Context Sent to Reviewer** | Only the keys whitelisted in `display_context` |
| **Response Form Fields** | Each `human_feedback` field: name, type, label, required |
| **Auth** | `required_group` / `assignee_user` after interpolation |
| **Instance Info** | Generated `instance_id`, `paused_step_id`, and `output_key` |

### Example mock input

Given a step with `display_context: [candidate_name, role]`:

```json
{
  "candidate_name": "Jane Doe",
  "role": "Senior Engineer",
  "cv_summary": "10 years backend, Python, distributed systems."
}
```

Lens will show `candidate_name` and `role` in the **Context Sent to Reviewer** section
(because they are in `display_context`) and omit `cv_summary`.

### What Lens does NOT do for HITL

Lens shows the *outbound* payload only. It does not:

- store a real HITL instance in Redis
- allow you to submit a reviewer response and see the resumed workflow output

To test the full resume cycle use **Spectrum** with a workflow that includes the HITL step,
or trigger the workflow normally in dev mode and use the `/hitl/{instance_id}/respond`
endpoint with mock reviewer data.

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
| Inspect the HITL payload a `HumanInTheLoop` step would send | Lens (see Suspended tab) |
| Ad-hoc LLM assertion on a single step without writing a test file | Spectrum (Evaluate tab) |

