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
| `kind` | Yes | Step type: `functional`, `agent`, `router`, `api_call`, `mcp`, `HumanInTheLoop` |
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
    model: "ollama/llama3"              # LiteLLM model string
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
| `model` | Required | LiteLLM model identifier |
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

Conditional branching based on context values:

```yaml
- id: "check_amount"
  kind: "router"
  router:
    conditions:
      - if: "amount > 10000"
        signal: "high_value"
      - if: "amount > 1000"
        signal: "medium_value"
      - else: true
        signal: "low_value"
  routes:
    high_value: "manual_review"
    medium_value: "auto_approve"
    low_value: "instant_approve"
```

### API Call Steps

Make HTTP requests to external services:

```yaml
- id: "fetch_weather"
  kind: "api_call"
  api:
    url: "https://api.weather.com/v1/current"
    method: "GET"
    headers:
      Authorization: "Bearer {{ api_key }}"
    params:
      location: "{{ city }}"
    output:
      map:
        temp: temperature
        conditions: weather_conditions
  routes:
    success: "next_step"
    error: "fallback"
```

### MCP Steps

Call tools from MCP (Model Context Protocol) servers:

```yaml
- id: "search_docs"
  kind: "mcp"
  mcp:
    server: "docs-server"
    tool: "search"
    arguments:
      query: "{{ search_query }}"
    output:
      map:
        results: search_results
```

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

1. Persists a **HITL instance** (stored in Redis) containing the current context and the step definition.
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
