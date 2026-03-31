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
| `kind` | Yes | Step type: `functional`, `agent`, `router`, `api_call`, `mcp` |
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
- [Examples](../examples/candidate-onboarding.md) — Complete workflow examples
