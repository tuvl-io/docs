# Workflows

Workflows are the heart of tuvl — they define how data flows through your business logic.

## Workflow Structure

A workflow is defined in YAML with four main sections:

```yaml
kind: "Workflow"
version: "v1"

metadata:
  name: "my_workflow"
  description: "What this workflow does"

spec:
  trigger:
    path: "/api/my-endpoint"
    method: "POST"
    input_schema: "context"
    response_schema: "context"

  context: "MyModel"

  steps:
    - id: "step_1"
      kind: "Functional"
      runner: "my_node"
```

## Metadata

Every workflow needs a unique name and optional description:

```yaml
metadata:
  name: "order_processing"
  description: "Process incoming orders with fraud detection"
  schema_version: "v1"       # optional — defaults to "v1" when omitted
```

The name is used for:

- Logging and debugging
- API route generation
- Workflow identification in the UI

### `schema_version`

Tag a workflow definition with a version string. Multiple versions of the same
workflow (same `metadata.name`) can coexist in one file using `---` document
separators or in separate files:

```yaml title="workflows/onboard.yaml"
kind: "Workflow"
metadata:
  name: "onboard"
  schema_version: "v1"
steps: [...]

---

kind: "Workflow"
metadata:
  name: "onboard"
  schema_version: "v2"
enabled: false          # staged — activate via admin API
steps: [...]            # revised step set
```

`schema_version` defaults to `"v1"` when omitted.

### `enabled`

| Value | Behaviour |
|-------|-----------|
| `true` (default) | Workflow is mounted and accepts requests |
| `false` | Tracked in `WORKFLOW_VERSION_REGISTRY` for admin purposes but **not** mounted; requests return 400 |

Disabled versions are visible in the admin panel and can be toggled without a server restart.

## Trigger Configuration

The trigger defines how the workflow is exposed as an HTTP endpoint:

```yaml
trigger:
  path: "/api/orders"           # URL path
  method: "POST"                # HTTP method
  input_schema: "context"       # Request body validation
  response_schema: "context"    # Response body validation
```

### Schema Options

| Value | Description |
|-------|-------------|
| `"context"` | Use the workflow's context model (Create/Read variants) |
| `"ModelName.variant"` | Specific model and variant (e.g., `"Order.create"`) |
| Inline array | Define fields inline |

**Inline schema example:**

```yaml
trigger:
  path: "/api/webhook"
  method: "POST"
  input_schema:
    - name: "event_type"
      type: "string"
      required: true
    - name: "payload"
      type: "string"
```

## Context Model

The `context` field links the workflow to one or more data models.

### Simple form — single model

```yaml
context: "Contact"
```

### List form — multiple models

```yaml
context:
  - "Candidate"
  - "Job"
```

### Dict form — explicit model version pinning

Use the dict form to target a specific `schema_version` of a model at execution
time. This is the recommended form when using model versioning:

```yaml
context:
  models:
    - name: "Candidate"
      version: "v2"     # use Candidate v2 for this workflow
    - name: "Job"       # no version — uses the active version
```

The `version` key is optional per entry. When omitted, the currently enabled
version in `MODEL_REGISTRY` is used.

All forms enable:

- Auto-generated schemas for input/output validation
- Type hints in the UI workflow builder
- Repository access within nodes

## Steps

Steps are executed sequentially (with routing for branching):

```yaml
steps:
  - id: "validate"
    kind: "Functional"
    runner: "validate_input"
    routes:
      valid: "process"
      invalid: "reject"
      
  - id: "process"
    kind: "Agent"
    agent:
      model: "ollama/llama3"
      prompt: "..."
      
  - id: "reject"
    kind: "Functional"
    runner: "send_rejection"
```

### Step Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique identifier within the workflow |
| `kind` | Yes | Step type: `Functional`, `Agent`, `AutonomousAgent`, `Router`, `APICall`, `MCP`, `ModelOp`, `Response`, `HumanInTheLoop` |
| `runner` | For functional | Node name from `NODE_REGISTRY` |
| `agent` | For agent | LLM configuration |
| `routes` | No | Signal-to-step mapping |

## Step Kinds

### Functional Steps

Execute a registered Python node:

```yaml
- id: "save_order"
  kind: "Functional"
  runner: "db_save"        # Must exist in NODE_REGISTRY
```

The node function receives and returns the context:

```python
@node("db_save")
async def db_save(ctx: dict[str, Any]) -> dict[str, Any]:
    session = ctx["_session"]
    repo = get_repository("Order", session)
    order = await repo.add(ctx)
    ctx["id"] = str(order.id)
    return ctx
```

### Agent Steps

Execute an LLM call with structured output:

```yaml
- id: "classify"
  kind: "Agent"
  agent:
    model: "default"                # preset name from llms/default.yaml
    # or use a LiteLLM model string directly:
    # model: "ollama/llama3"
    # model: "gpt-4o-mini"
    system: |
      You are a customer support classifier.
    prompt: |
      Message: {{ message }}
      
      Classify as: urgent, normal, spam
      Return JSON: {"category": "..."}
    output:
      format: json
      map:
        category: message_category       # LLM key → context key
      signal_from: category              # Use for routing
    retry:
      attempts: 3
      on: [parse_error, timeout]
    timeout: 30
  routes:
    urgent: "escalate"
    normal: "queue"
    spam: "discard"
```

#### Agent Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `model` | Required | Preset name from `llms/<name>.yaml` (no `/`) or a LiteLLM model string (e.g. `ollama/llama3`, `gpt-4o`) |
| `system` | `""` | System prompt |
| `prompt` | Required | User prompt with Jinja2 templating |
| `output.format` | `"json"` | Output format: `json`, `text`, `signal` |
| `output.map` | `{}` | Map LLM response keys to context keys |
| `output.signal_from` | `null` | Context key to use as route signal |
| `retry.attempts` | `1` | Number of retry attempts |
| `retry.on` | `[]` | Error types to retry on |
| `retry.backoff` | `1` | Backoff multiplier between retries |
| `timeout` | `60` | Timeout in seconds |
| `context_injection` | `[]` | List of context keys whose values are appended as a system message (RAG / search-result grounding) |

### Autonomous Agent Steps

Where an `agent` step is a single LLM call, an `AutonomousAgent` step runs a **bounded tool-calling loop**: the model is given its steering and a set of declared tools, autonomously chooses which to call, observes the results, and re-decides until it emits one of a declared `outcome.enum`. Autonomy stays inside the contract — the tools are a closed author-declared set, the exits are a closed set, and the loop is capped.

```yaml
- id: "triage"
  kind: "AutonomousAgent"
  agent:
    model: "default"
    steering: "Resolve the support ticket using the available tools."
    max_iterations: 8                  # hard cap (default 8)
    token_budget: 50000                # optional cap on cumulative tokens
    skills:                            # project-relative .md files injected into the system prompt
      - ".agents/skills/support-policy.md"
    tools:
      - ref: "lookup_order"            # names ANOTHER step in this workflow
        description: "Fetch order details by order id."  # optional — overrides lookup_order's own description:
        parameters:
          type: object
          properties: { order_id: { type: string } }
          required: [order_id]
      - ref: "issue_refund"            # description defaults to issue_refund's top-level description:
    outcome:
      enum: ["resolved", "escalate", "needs_human"]   # the closed set of exits
      output_key: "agent_result"                      # single data output
  routes:
    resolved: "format_reply"
    escalate: "notify_manager"
    needs_human: "hitl_review"
    max_iterations: "fallback_summary"   # reserved abnormal exits
    error: "alert_ops"
    budget_exceeded: "fallback_summary"
```

| Property | Default | Description |
|----------|---------|-------------|
| `model` | Required | Preset name or LiteLLM model string (same as `agent`) |
| `steering` | Required | The agent's persistent instruction, always injected |
| `skills` | `[]` | Optional list of project-relative `.md` files injected into the agent's system prompt |
| `tools` | `[]` | Tools the agent may call; each `ref` names another step (`APICall` / `MCP` / `ModelOp` / `Functional`) with JSON-Schema `parameters`. The tool description defaults to the referenced step's top-level `description:`; `description` here is an optional override |
| `tools[].writes_context` | `false` | When `true`, the tool's public output is merged back into the shared context (default: result returns to the agent only) |
| `outcome.enum` | `[]` | Closed set of exit signals; **every value must be mapped in `routes:`** |
| `outcome.output_key` | `<id>_result` | Context key that receives the agent's final output |
| `max_iterations` | `8` | Hard cap on loop turns |
| `token_budget` | `null` | Optional hard cap on cumulative tokens |

The reserved abnormal exits `max_iterations`, `budget_exceeded`, and `error` should also be mapped in `routes:`. For data-driven branching after an outcome, route into a deterministic [`router` with `match:`](#router-steps) — never push that logic into the agent.

### Router Steps

Evaluate a condition on the context and branch to different steps:

```yaml
- id: "check_amount"
  kind: "Router"
  condition:
    field: "amount"          # context key (dot-path supported: "order.amount")
    operator: "gte"          # eq | neq | gt | gte | lt | lte | in | contains | is_empty | is_not_empty
    value: 10000
  routes:
    "true": "manual_review"
    "false": "auto_approve"
```

The router emits `"true"` or `"false"` as the route signal.

For multi-way value branching (e.g. by country or tier), use the `match:` switch instead of `condition:`. It emits the stringified value of a field as the route signal, falling back to `default` when the value isn't mapped:

```yaml
- id: "route_by_country"
  kind: "Router"
  match:
    field: "user.country"     # dot-path supported
  routes:
    US: "resolve_us"
    DE: "resolve_eu"
    FR: "resolve_eu"
    default: "resolve_other"  # any unmapped value lands here
```

This is the idiomatic way to add data-driven branching after an `AutonomousAgent` outcome — keep the deterministic logic in the router, not in the model.

Chain multiple routers for more complex conditional branching:

```yaml
steps:
  - id: "check_high"
    kind: "Router"
    condition:
      field: "amount"
      operator: "gte"
      value: 10000
    routes:
      "true": "manual_review"
      "false": "check_medium"

  - id: "check_medium"
    kind: "Router"
    condition:
      field: "amount"
      operator: "gte"
      value: 1000
    routes:
      "true": "auto_approve"
      "false": "instant_approve"
```

#### Supported Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equal to value |
| `neq` | Not equal to value |
| `gt` | Greater than value |
| `gte` | Greater than or equal to value |
| `lt` | Less than value |
| `lte` | Less than or equal to value |
| `in` | Value is in a list |
| `contains` | String contains value |
| `is_empty` | Field is `None`, `""`, or `[]` |
| `is_not_empty` | Field is not empty |

### API Call Steps

Make HTTP requests to external services:

```yaml
- id: "fetch_weather"
  kind: "APICall"
  http:
    url: "https://api.weather.com/v1/current"
    method: "GET"
    headers:
      Authorization: "Bearer {{ api_key }}"
    timeout: 30               # seconds (default: 30)
  response:
    output_key: "weather_raw" # context key for the full response body
    extract:
      - path: "current.temp_c"
        as: "temperature"
      - path: "current.condition.text"
        as: "weather_conditions"
  routes:
    default: "next_step"
    error: "fallback"
```

On HTTP errors the engine sets `_last_error` and `_api_status_code` in context and emits the `"error"` signal.

### MCP Steps

Call tools from MCP (Model Context Protocol) servers. Two transports are supported: **SSE** (default) and **stdio**.

**SSE transport:**

```yaml
- id: "search_docs"
  kind: "MCP"
  mcp:
    transport: "sse"                          # default
    url: "http://localhost:3001/sse"
    tool: "search"
    arguments:
      query: "{{ search_query }}"
  response:
    output_key: "search_results"              # full response stored here
    extract:
      - path: "0.title"
        as: "first_result_title"
```

**stdio transport (local MCP server):**

```yaml
- id: "list_issues"
  kind: "MCP"
  mcp:
    transport: "stdio"
    command: "npx"
    args: ["@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{ github_token }}"
    tool: "list_issues"
    arguments:
      owner: "{{ repo_owner }}"
      repo: "{{ repo_name }}"
  response:
    output_key: "issues"
```

### Model-Op Steps

Perform a CRUD operation on a registered model without writing a Python node. The model must be declared in the workflow's `context:` field.

```yaml
- id: "create_candidate"
  kind: "ModelOp"
  model: "Candidate"            # PascalCase model name from MODEL_REGISTRY
  operation: "create"           # create | read | list | update | delete
  payload: "{{ candidate }}"    # dict or {{template}} — used by create / update
  output: "new_candidate"       # context key to store the result
  routes:
    default: "next_step"
    error: "handle_error"
```

**Read with relations:**

```yaml
- id: "fetch_candidate"
  kind: "ModelOp"
  model: "Candidate"
  operation: "read"
  record_id: "{{ candidate_id }}"
  include: "education,experience"   # comma-separated relation names
  output: "candidate"
```

**List with filters:**

```yaml
- id: "list_pending"
  kind: "ModelOp"
  model: "Application"
  operation: "list"
  filters:
    status: "pending"
  limit: 50
  output: "pending_applications"
```

#### Model-Op Properties

| Property | Required | Description |
|----------|----------|-------------|
| `model` | Yes | PascalCase model name from `MODEL_REGISTRY` |
| `operation` | Yes | `create` \| `read` \| `list` \| `update` \| `delete` |
| `payload` | For create/update | Dict or `{{template}}` reference to a context dict |
| `record_id` | For read/update/delete | Primary key value; supports `{{template}}` |
| `filters` | For list | Equality filter dict |
| `include` | No | Comma-separated relation names to expand (read/list only) |
| `limit` | No | Max rows for list (default 100) |
| `output` | No | Context key for the result (default: `{step_id}_result`) |

### Response Steps

Shape the HTTP response without ending the workflow (useful as the last step in complex workflows):

```yaml
# Source mode — expose an existing context key as-is
- id: "respond"
  kind: "Response"
  source: "candidate"

# Mapping mode — project specific fields from nested context
- id: "respond"
  kind: "Response"
  mapping:
    id: "candidate.id"
    full_name: "candidate.name"
    score: "evaluation.total_score"
```

The shaped payload is stored in `context["_response"]`, which the engine returns as the HTTP response body (takes priority over the default context serialisation).

### Human-in-the-Loop Steps

Pause workflow execution and hand off control to a human reviewer before continuing:

```yaml
- id: "approve_application"
  kind: "HumanInTheLoop"
  ui:
    title: "Review Application"
    instruction: "Approve or reject {{ candidate_name }}'s application for {{ role }}."
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

When the engine reaches a `HumanInTheLoop` step it:

1. Persists a **HITL instance** (a `SystemWorkflowInstance` row in the database) containing the current context snapshot and the step definition.
2. Raises a suspension signal — the workflow API responds with HTTP **202 Accepted** (or a `SUSPENDED` gRPC status) and returns a `hitl_request` payload.
3. The frontend displays the review form to the designated user.
4. Once the reviewer submits their response the workflow resumes from the next step, with the human's answers merged into the context under `output_key`.

#### Human-in-the-Loop Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique step identifier |
| `kind` | Yes | Must be `HumanInTheLoop` |
| `ui.title` | No | Heading shown to the reviewer. Supports `{{ var }}` interpolation. |
| `ui.instruction` | No | Detailed instructions for the reviewer. Supports `{{ var }}` interpolation. |
| `ui.display_context` | No | Allowlist of context keys sent to the reviewer. If omitted, **no** context data is forwarded. |
| `human_feedback` | No | List of form field definitions (see below). If empty the reviewer can only approve/dismiss. |
| `output_key` | No | Context key under which the reviewer's answers are stored. Defaults to `hitl_<id>`. |
| `auth.required_group` | No | IAM group required to act on this review. |
| `auth.assignee_user` | No | Specific user assigned as reviewer. Supports `{{ var }}` interpolation. |

#### `human_feedback` Field Definition

Each entry in `human_feedback` defines one input field on the review form:

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `name` | Yes | string | Key used in the output dict |
| `type` | Yes | string | `boolean`, `string`, `integer`, or `float` |
| `label` | No | string | Human-readable label shown above the input |
| `required` | No | boolean | Prevent form submission until filled. Defaults to `false`. |

#### `hitl_request` Payload

The payload delivered to the frontend when a workflow suspends:

```json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "paused_step_id": "approve_application",
  "output_key": "approval_result",
  "ui": {
    "title": "Review Application",
    "instruction": "Approve or reject Jane Doe's application for Senior Engineer.",
    "display_context": ["candidate_name", "role", "cv_summary"]
  },
  "human_feedback": [
    { "name": "approved", "type": "boolean", "required": true, "label": "Approve application?" },
    { "name": "notes",    "type": "string",  "required": false, "label": "Reviewer notes" }
  ],
  "context_data": {
    "candidate_name": "Jane Doe",
    "role": "Senior Engineer",
    "cv_summary": "10 years backend, Python, distributed systems."
  },
  "auth": { "required_group": "hr_manager" }
}
```

#### Resuming a Suspended Workflow

POST the reviewer's answers to the HITL resume endpoint:

```http
POST /hitl/{instance_id}/respond
Content-Type: application/json

{
  "approved": true,
  "notes": "Strong candidate, approved."
}
```

The engine resumes execution with `context["approval_result"]` set to that dict.

See [Human-in-the-Loop](../tools/hitl.md) for the full API reference and UI builder details.

## Routing

Routes determine the next step based on signals:

```yaml
- id: "process"
  kind: "Functional"
  runner: "process_data"
  routes:
    success: "notify"           # On "success" signal → go to "notify"
    retry: "process"            # On "retry" signal → loop back
    error: "handle_error"       # On "error" signal → go to error handler
    default: "cleanup"          # Fallback for unmatched signals
```

### Special Route Targets

| Target | Behavior |
|--------|----------|
| `"END"` | Stop workflow execution |
| Step ID | Jump to that step |
| (none) | Continue to next sequential step |

### Signal Sources

Nodes can return signals in three ways:

```python
# 1. Return string → signal
@node("check_inventory")
async def check(ctx):
    if ctx["quantity"] > ctx["stock"]:
        return "out_of_stock"
    return "in_stock"

# 2. Return dict → updated context, default signal
@node("process")
async def process(ctx):
    ctx["processed"] = True
    return ctx

# 3. Return tuple → (context, signal)
@node("validate")
async def validate(ctx):
    if valid(ctx):
        return ctx, "valid"
    return ctx, "invalid"
```

## Jinja2 Templating

Prompts and configurations support Jinja2 templates:

```yaml
prompt: |
  Customer: {{ customer_name }}
  Order Total: ${{ "%.2f"|format(total) }}
  Items:
  {% for item in items %}
  - {{ item.name }}: {{ item.quantity }}
  {% endfor %}
```

Available in templates:

- All context keys
- Jinja2 filters (`|format`, `|upper`, `|default`, etc.)
- Conditionals and loops

## Error Handling

### Step-Level Errors

Use the `error` route to handle step failures:

```yaml
- id: "risky_step"
  kind: "Functional"
  runner: "external_api_call"
  routes:
    default: "next"
    error: "fallback"

- id: "fallback"
  kind: "Functional"
  runner: "log_and_continue"
```

### Workflow-Level Errors

If an error occurs without a mapped route, the workflow:

1. Sets `_last_error` in context
2. Stops execution
3. Returns a 400/500 response with error details

### Retry Configuration

For agent steps:

```yaml
agent:
  retry:
    attempts: 3
    on: [parse_error, timeout, rate_limit]
    backoff: 2    # Exponential backoff multiplier
```

## Workflow Versioning

tuvl tracks every `(name, schema_version)` pair in `WORKFLOW_VERSION_REGISTRY` (in
memory) and in the `workflow_versions` database table (on the primary datasource).
This lets you manage the lifecycle of workflow changes without YAML edits or server
restarts.

### Listing all versions

```bash
GET /admin/workflows
```

Returns a dict keyed by workflow name, each value being a list of version objects:

```json
{
  "onboard": [
    { "schema_version": "v1", "enabled": true,  "trigger_path": "/api/onboard", "trigger_method": "POST" },
    { "schema_version": "v2", "enabled": false, "trigger_path": "/api/onboard", "trigger_method": "POST" }
  ]
}
```

### Toggling a version on/off

```bash
PATCH /admin/workflows/{name}/{version}/toggle
```

Flips `enabled` in the database without touching YAML. Changes take effect
immediately for new requests.

### Forking a version

The fork endpoint deep-copies an existing version's config, stamps it with a new
`schema_version`, writes it to `workflows/`, and returns the filename:

```bash
POST /admin/workflows/onboard/v1/fork
{ "new_version": "v2" }
```

```json
{ "name": "onboard", "source_version": "v1", "new_version": "v2", "file": "onboard_v2.yaml" }
```

See [Admin Version Management API](../api/endpoints.md#version-management-admin-api) for full endpoint reference.

## Best Practices

### 1. Keep Steps Small

Each step should do one thing well:

```yaml
# Good
steps:
  - id: "validate"
  - id: "transform"
  - id: "save"
  - id: "notify"

# Avoid
steps:
  - id: "do_everything"
```

### 2. Use Meaningful IDs

```yaml
# Good
- id: "verify_email_format"
- id: "check_duplicate_user"

# Avoid
- id: "step_1"
- id: "step_2"
```

### 3. Handle All Routes

Always define error routes for critical steps:

```yaml
- id: "payment"
  routes:
    success: "fulfill"
    declined: "notify_decline"
    error: "manual_review"    # Don't forget this!
```

### 4. Use Context Prefixes

Organize context keys with prefixes:

```yaml
output:
  map:
    result: "ai_classification"    # Prefix with source
    confidence: "ai_confidence"
```

## Next Steps

- [Nodes](nodes.md) — Building node functions
- [Agents](../configuration/agents.md) — Configuring LLM providers
- [Human-in-the-Loop](../tools/hitl.md) — Full HITL reference, UI builder, and Lens testing
- [Examples](../examples/candidate-onboarding.md) — Complete workflow examples
