# Workflows

Workflows are the heart of tuvl — they define how data flows through your business logic.

## Workflow Structure

A workflow is defined in YAML with four main sections:

```yaml
kind: "Workflow"

metadata:
  name: "my_workflow"
  description: "What this workflow does"

trigger:
  path: "/api/my-endpoint"
  method: "POST"
  input_schema: "context"
  response_schema: "context"

context: "MyModel"

steps:
  - id: "step_1"
    kind: "functional"
    runner: "my_node"
```

## Metadata

Every workflow needs a unique name and optional description:

```yaml
metadata:
  name: "order_processing"
  description: "Process incoming orders with fraud detection"
```

The name is used for:

- Logging and debugging
- API route generation
- Workflow identification in the UI

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

The `context` field links the workflow to a data model:

```yaml
context: "Contact"
```

This enables:

- Auto-generated schemas for input/output validation
- Type hints in the UI workflow builder
- Repository access within nodes

## Steps

Steps are executed sequentially (with routing for branching):

```yaml
steps:
  - id: "validate"
    kind: "functional"
    runner: "validate_input"
    routes:
      valid: "process"
      invalid: "reject"
      
  - id: "process"
    kind: "agent"
    agent:
      model: "ollama/llama3"
      prompt: "..."
      
  - id: "reject"
    kind: "functional"
    runner: "send_rejection"
```

### Step Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique identifier within the workflow |
| `kind` | Yes | Step type: `functional`, `agent`, `router`, `api_call`, `mcp`, `model-op`, `response`, `HumanInTheLoop` |
| `runner` | For functional | Node name from `NODE_REGISTRY` |
| `agent` | For agent | LLM configuration |
| `routes` | No | Signal-to-step mapping |

## Step Kinds

### Functional Steps

Execute a registered Python node:

```yaml
- id: "save_order"
  kind: "functional"
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
  kind: "agent"
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

### Router Steps

Evaluate a condition on the context and branch to different steps:

```yaml
- id: "check_amount"
  kind: "router"
  condition:
    field: "amount"          # context key (dot-path supported: "order.amount")
    operator: "gte"          # eq | neq | gt | gte | lt | lte | in | contains | is_empty | is_not_empty
    value: 10000
  routes:
    "true": "manual_review"
    "false": "auto_approve"
```

The router emits `"true"` or `"false"` as the route signal. Chain multiple routers for more complex branching:

```yaml
steps:
  - id: "check_high"
    kind: "router"
    condition:
      field: "amount"
      operator: "gte"
      value: 10000
    routes:
      "true": "manual_review"
      "false": "check_medium"

  - id: "check_medium"
    kind: "router"
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
  kind: "api_call"
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
  kind: "mcp"
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
  kind: "mcp"
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
  kind: "model-op"
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
  kind: "model-op"
  model: "Candidate"
  operation: "read"
  record_id: "{{ candidate_id }}"
  include: "education,experience"   # comma-separated relation names
  output: "candidate"
```

**List with filters:**

```yaml
- id: "list_pending"
  kind: "model-op"
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
  kind: "response"
  source: "candidate"

# Mapping mode — project specific fields from nested context
- id: "respond"
  kind: "response"
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
  kind: "functional"
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
  kind: "functional"
  runner: "external_api_call"
  routes:
    default: "next"
    error: "fallback"

- id: "fallback"
  kind: "functional"
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
