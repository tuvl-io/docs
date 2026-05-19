# Human-in-the-Loop (HITL)

The `HumanInTheLoop` step kind pauses a workflow and delegates a decision to a human
reviewer before execution continues. It is ideal for approval flows, content moderation,
exception handling, and any scenario where automated logic alone is not sufficient.

!!! note "Persistence required"
    HITL requires Redis. The suspended workflow state is stored in Redis under a generated
    `instance_id` until the reviewer responds or the instance expires. Configure Redis in
    your project's `tuvl.yaml` — see [Redis configuration](../configuration/redis.md).

---

## Authoring a HITL Step

Add a `HumanInTheLoop` step anywhere in a workflow YAML:

```yaml
- id: "approve_application"
  kind: "HumanInTheLoop"
  ui:
    title: "Review Application — {{ candidate_name }}"
    instruction: |
      Please review {{ candidate_name }}'s application for {{ role }}.
      CV summary: {{ cv_summary }}
    display_context:
      - candidate_name
      - role
      - cv_summary
  human_feedback:
    - name: approved
      type: boolean
      required: true
      label: "Approve application?"
    - name: notes
      type: string
      label: "Reviewer notes"
  output_key: approval_result
  auth:
    required_group: hr_manager
    assignee_user: "{{ assigned_reviewer }}"
  routes:
    default: "send_outcome"
```

### Full Property Reference

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique step identifier within the workflow |
| `kind` | Yes | Must be `HumanInTheLoop` |
| `ui.title` | No | Heading shown on the review form. Supports `{{ var }}` interpolation from the current context. |
| `ui.instruction` | No | Body text / instructions for the reviewer. Supports `{{ var }}` interpolation. |
| `ui.display_context` | No | Allowlist of context keys forwarded to the reviewer. Keys not in this list are never sent to the frontend. If the list is empty no context data is forwarded. |
| `human_feedback` | No | Ordered list of form field definitions (see below). If omitted the reviewer sees text only. |
| `output_key` | No | Context key that will hold the reviewer's answers dict after resumption. Defaults to `hitl_<id>`. |
| `auth.required_group` | No | IAM group that must be present in the reviewer's token. Requests from other groups receive 403. |
| `auth.assignee_user` | No | Specific user ID assigned as the reviewer. Supports `{{ var }}` interpolation. |
| `routes` | No | Signal-to-step routing table applied after the step resumes. |

### `human_feedback` Field Definition

Each item in the `human_feedback` list defines one input on the reviewer's form:

| Key | Required | Allowed Types | Description |
|-----|----------|---------------|-------------|
| `name` | Yes | — | Key used in the output dict stored at `output_key` |
| `type` | Yes | `boolean` `string` `integer` `float` | Data type of the input |
| `label` | No | — | Human-readable label displayed above the field |
| `required` | No | — | Block form submission if the field is empty. Defaults to `false`. |

---

## Runtime Behaviour

```
Workflow Engine
      │
      ▼
  HumanInTheLoop step
      │
      ├─ Interpolate ui.title / ui.instruction / auth.assignee_user
      ├─ Build context_data from display_context allowlist
      ├─ Persist HITL instance in Redis  (instance_id + context snapshot)
      └─ Raise SuspendWorkflowException(hitl_request=…)
             │
             ▼
      API layer catches exception
             │
             ├─ REST:  HTTP 202  + JSON body  { hitl_request }
             └─ gRPC:  status SUSPENDED  + snapshot_json
```

### `hitl_request` Payload

The payload returned to the caller on suspension:

```json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "paused_step_id": "approve_application",
  "output_key": "approval_result",
  "ui": {
    "title": "Review Application — Jane Doe",
    "instruction": "Please review Jane Doe's application for Senior Engineer…",
    "display_context": ["candidate_name", "role", "cv_summary"]
  },
  "human_feedback": [
    { "name": "approved", "type": "boolean", "required": true,  "label": "Approve application?" },
    { "name": "notes",    "type": "string",  "required": false, "label": "Reviewer notes" }
  ],
  "context_data": {
    "candidate_name": "Jane Doe",
    "role": "Senior Engineer",
    "cv_summary": "10 years backend, Python, distributed systems."
  },
  "auth": {
    "required_group": "hr_manager",
    "assignee_user": "reviewer@example.com"
  }
}
```

---

## Resuming a Suspended Workflow

### REST

```http
POST /hitl/{instance_id}/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "notes": "Strong candidate, fast-track to onboarding."
}
```

**Success response** — `200 OK` with the final workflow output:

```json
{
  "approval_result": {
    "approved": true,
    "notes": "Strong candidate, fast-track to onboarding."
  },
  "candidate_name": "Jane Doe"
}
```

The reviewer's answers are merged into the context as:
```python
context[output_key] = { "approved": True, "notes": "…" }
```

Execution then continues from the step after `approve_application` (or the step mapped in
`routes`).

### Error Responses

| Status | Reason |
|--------|--------|
| `404 Not Found` | `instance_id` does not exist or has already been consumed |
| `403 Forbidden` | Caller is not in `auth.required_group` or is not the `assignee_user` |
| `410 Gone` | Instance expired (default TTL: 7 days) |

---

## Workflow Builder UI

The **workflow builder** in the dev console provides a dedicated editor for
`HumanInTheLoop` nodes.

### Node card (canvas)

The canvas node shows a compact summary:
- Step title (from `ui.title`) or output key, falling back to *configure ↗*
- A human-silhouette icon distinguishing HITL nodes from functional/agent steps

Click the node to open the inline form. Click **Configure HITL ↗** to open the full
right-panel editor.

### Right-panel editor fields

| Field | Maps to |
|-------|---------|
| Title | `ui.title` |
| Output key | `output_key` |
| Instruction | `ui.instruction` |
| Display context keys | `ui.display_context` (comma-separated list) |
| Auth group | `auth.required_group` |
| Auth assignee | `auth.assignee_user` |
| Human Feedback | `human_feedback` — row-based field editor (name / type / label / required) |

#### Human Feedback row editor

Each row represents one field the reviewer will fill in. Use the **+ Add field** button to
add a row. Each row has:

- **name** — output dict key (auto-slugified)
- **type** — select from `boolean`, `string`, `integer`, `float`
- **label** — display label
- **req** checkbox — mark the field as required
- **✕** button — remove the field

---

## Testing HITL Nodes with Lens

Use **Lens** to inspect the `hitl_request` payload a HITL step would produce without
actually storing a Redis instance or blocking on reviewer input.

1. Open Lens on the HITL node from the node config sidebar.
2. Provide a **Mock Input** JSON containing all keys referenced in `display_context` and
   in any `{{ var }}` interpolations:

    ```json
    {
      "candidate_name": "Jane Doe",
      "role": "Senior Engineer",
      "cv_summary": "10 years backend, Python, distributed systems.",
      "assigned_reviewer": "reviewer@example.com"
    }
    ```

3. Click **Execute**. Lens catches the suspension and opens the **Suspended** tab.

The Suspended tab renders the full `hitl_request` in five sections:

| Section | Description |
|---------|-------------|
| **Review UI** | `title` and `instruction` after interpolation |
| **Context Sent to Reviewer** | Only the keys in `display_context` |
| **Response Form Fields** | Table listing each `human_feedback` entry |
| **Auth** | `required_group` and `assignee_user` after interpolation |
| **Instance Info** | `instance_id`, `paused_step_id`, `output_key` |

!!! tip "Lens limitations for HITL"
    Lens shows the outbound payload only. It does not persist a Redis instance or allow
    you to simulate the reviewer response. To test the full suspend → respond → resume
    cycle, trigger the workflow normally via its REST endpoint and call
    `POST /hitl/{instance_id}/respond` with mock reviewer data.

---

## Security Considerations

- `display_context` is an **explicit allowlist** — omitting it means *no* context data
  reaches the reviewer's browser, which is the safest default.
- `auth.required_group` is verified by the IAM layer at the `/hitl/respond` endpoint
  before the workflow resumes. A missing or mismatched group returns 403.
- HITL instance data in Redis is scoped to the `instance_id` UUID. Keys are not
  guessable and are deleted after the instance is consumed or expires.
- All `{{ var }}` interpolations in `ui` and `auth` fields are evaluated server-side
  — the frontend never receives the raw template strings.

---

## Related

- [Workflows — Human-in-the-Loop Steps](../concepts/workflows.md#human-in-the-loop-steps) — step authoring reference
- [Spectrum & Lens](spectrum.md) — testing tools overview
- [IAM](../security/iam.md) — group and user authentication
- [Redis configuration](../configuration/redis.md) — persistence setup
