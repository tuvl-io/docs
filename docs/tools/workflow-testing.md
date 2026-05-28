# Workflow Canvas — Test Mode

The Workflow Canvas editor ships a full **integrated test runner** so you can execute any
workflow against custom input, watch steps stream in live, and inspect every context
mutation — all without leaving the visual editor.

---

## Opening Test Mode

1. Open a workflow in the Workflow Canvas (`/insight` → **Workflows** → select a workflow).
2. Click **▶ Test** in the top-right metadata bar.  The left panel switches to the **Test** tab.
3. To close test mode, click **× Test Mode** in the same button (the label toggles).

---

## The Test Input Panel (left)

The left panel contains a **CodeMirror JSON editor** for the initial workflow input context.

### Input schema auto-scaffold

When you open the Test tab the editor automatically pre-fills every required field with an
empty string, derived from the workflow's `input_schema` setting:

| `input_schema` value | Where fields come from |
|----------------------|------------------------|
| `context` (default) | Required fields from the context models attached to this workflow |
| A model name (e.g. `Candidate`) | All fields of that model |
| A JSON array (e.g. `["email","name"]`) | The listed field names |

### Field chips

Above the editor a row of **field chips** shows every available key:

- **Sky chip** — field not yet present in the JSON; click to insert `"key": ""`
- **Emerald chip with ✓** — field already present in the JSON

### Editor toolbar

| Control | Action |
|---------|--------|
| **Format** | Pretty-prints the JSON |
| **▶ Run** / **⏹ Stop** | Start or abort a test run |

---

## Running a Test

Click **▶ Run**.  The following happens immediately and in sequence:

1. **Canvas selection is cleared** — deselects any focused node so the right panel is free.
2. **Right panel opens** on the **Test Out** tab automatically.
3. **Status bar appears** at the bottom of the canvas.
4. Step events stream in from the server via a gRPC-Web SSE connection.

### Node highlights on the canvas

As each step executes, its canvas node updates in real time:

| Status | Node ring | Status badge |
|--------|-----------|--------------|
| Running | Pulsing sky-blue ring | `●` sky |
| Success | Solid emerald ring | `✓` emerald |
| Error | Solid rose ring | `✗` rose |
| Partial | Amber ring | `!` amber |

The badge is a small `18 × 18 px` circle pinned to the top-right corner of the node and
remains visible after the run completes so you can see at a glance which steps succeeded
and which failed.

---

## The Test Out Panel (right — "Test Out" tab)

The right panel has two tabs: **YAML** (the existing YAML preview / editor) and
**Test Out** (the streaming test inspector).  The **Test Out** tab opens automatically
on Run.

### Status bar (top of panel)

Shows overall run status, step progress (`N/N steps ok`), and the ID of the currently
executing node.  If a top-level error occurred it appears inline here.

### Step list (left column)

A narrow scrollable list updated as events arrive:

| Entry | Description |
|-------|-------------|
| **★ Final State** | Pinned at the top once the run completes — click to browse the terminal context |
| **⏳ \<node id\>** | The step currently executing (pulsing, disappears when done) |
| **Step rows** | Each completed step in reverse-chronological order — icon, ID, duration |

Click any row to load its details in the right column.

### Step inspector (right column)

Three sub-tabs:

#### State (before / after diff)

A table showing every context key with colour-coded change type:

| Row colour | Change type | Indicator |
|------------|-------------|-----------|
| Emerald | Key added by this step | `+N` badge |
| Amber | Key value changed | `~N` badge |
| None | Value unchanged | `N same` badge |

Each row shows **Key**, **Before** value, and **After** value.  Long values are truncated
to 80 characters.

#### Logs

Raw log output captured during the step.  Displayed in a monospace pre-block.
Shows "No logs for this step." when none were emitted.

#### Error

The full exception detail if `status === 'error'`.  Displayed in rose monospace text.
Shows "No error detail." for successful steps.

### Final State view

Selecting **★ Final State** in the step list switches the inspector to a flat key-value
table of the complete terminal context (private keys prefixed with `_` are hidden).

---

## Bottom Status Bar

A thin bar at the bottom of the canvas appears as soon as a run starts and persists until
explicitly cleared:

| Element | Description |
|---------|-------------|
| Status badge | `⏳ Testing…` / `✓ Done` / `✗ Error` / `⚠ Partial` |
| Running node | `→ <node_id>` shown while executing |
| Step counter | `N/N steps ok` |
| Error excerpt | First line of any top-level error |
| **View Output ›** | Opens the right Test Out panel if it was closed |
| **✕ Clear** | Resets all test state and removes the bar |

---

## Stopping and Aborting

Click **⏹ Stop** (the Run button label changes while running) to abort the gRPC stream
immediately.  Any steps that completed before you stopped remain visible in the Test Out
panel and on the canvas nodes.

---

## Resizing Panels

Both side panels are independently resizable:

- **Left Test panel** — drag the right edge handle (appears on hover as a thin violet bar)
- **Right Test Out / YAML panel** — drag the left edge handle

Minimum / maximum widths are enforced so neither panel can collapse completely.

---

## Differences from the Standalone Spectrum Page

| Feature | Workflow Canvas Test Mode | Standalone Spectrum page |
|---------|--------------------------|--------------------------|
| Trigger | Click **▶ Run** in editor toolbar | Submit form with workflow name + JSON |
| Streaming | Live, step-by-step via gRPC SSE | Same |
| Canvas node highlights | Yes — real-time ring + badge on each node | No (separate flow view) |
| Input auto-scaffold | Yes — from `input_schema` | No |
| Run until step | Yes — right-click "Run to here" on any node | No |
| Scope | Only the workflow currently open in the editor | Any workflow by name |
| Available in | Workflow Canvas (`/insight`) | Spectrum page (`/insight`) |

Both use the same underlying `DevService.RunSpectrum` gRPC call.

---

## Related

- [Spectrum — Workflow Debugging](spectrum.md) — standalone Spectrum page and API reference
- [Testing Workflows](testing.md) — automated YAML-driven test cases with LLM-as-a-Judge
- [Human-in-the-Loop](hitl.md) — testing HITL steps with Lens
