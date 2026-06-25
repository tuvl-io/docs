# Nodes

Nodes are Python functions that execute `Functional` workflow steps. Every step in a workflow has a **kind** — this page covers all available step kinds, their UI colours, and how to write custom `Functional` nodes.

---

## Step Kind Reference

tuvl has 8 built-in step kinds. The table below maps each kind to its icon and colour in the workflow canvas UI (sourced from `ui/src/components/StepNode.tsx`), plus its purpose and the signals it can emit.

<div class="step-kind-table" markdown>

| Kind | UI colour | Icon | Purpose | Emits |
|------|-----------|------|---------|-------|
| `Functional` | :material-circle:{ style="color:#3b82f6" } **Blue** | :material-code-braces: | Run a custom Python `@node()` function | Any string / tuple |
| `Agent` | :material-circle:{ style="color:#a855f7" } **Purple** | :material-star-four-points: | Call an LLM via LiteLLM or an `llms/` preset | `default` · `error` · `timeout` · `parse_error` · custom from `signal_from` |
| `Router` | :material-circle:{ style="color:#f59e0b" } **Amber** | :material-rhombus: | Evaluate a condition on context, branch true/false | `"true"` · `"false"` · `"error"` |
| `APICall` | :material-circle:{ style="color:#14b8a6" } **Teal** | :material-web: | Make an outbound HTTP request | `default` · `error` |
| `MCP` | :material-circle:{ style="color:#ec4899" } **Pink** | :material-connection: | Call a tool on an MCP server (SSE or stdio) | `default` · `error` |
| `ModelOp` | :material-circle:{ style="color:#10b981" } **Emerald** | :material-database: | CRUD operation on a registered model (no Python needed) | `default` · `error` |
| `Response` | :material-circle:{ style="color:#ef4444" } **Red** | :material-send: | Shape the HTTP response body | `default` · `error` |
| `HumanInTheLoop` | :material-circle:{ style="color:#f97316" } **Orange** | :material-account-clock: | Pause execution for a human reviewer | *(suspends — never routes)* |

</div>

---

## Functional

**UI colour:** :material-circle:{ style="color:#3b82f6" } Blue — `border-blue-600 bg-blue-950`

Run any custom Python async function registered with `@node("name")`.

```yaml
- id: "normalize"
  kind: "Functional"
  runner: "normalize_email"    # must exist in NODE_REGISTRY
  routes:
    default: "save"
    error: "handle_error"
```

```python title="nodes/contacts.py"
from tuvl.core.nodes.base import node

@node("normalize_email")
async def normalize_email(ctx: dict) -> dict:
    ctx["email"] = ctx.get("email", "").lower().strip()
    return ctx
```

**Signals:** return a `str` for a named signal, a `dict` for `"default"`, or a `tuple[dict, str]` for both.

---

## Agent

**UI colour:** :material-circle:{ style="color:#a855f7" } Purple — `border-purple-600 bg-purple-950`

Call an LLM. Supports any LiteLLM model string or a named preset from `llms/<name>.yaml`.

```yaml
- id: "evaluate"
  kind: "Agent"
  agent:
    model: "default"              # llms/default.yaml — or "gpt-4o-mini", "ollama/llama3" etc.
    system: "You are an HR evaluator."
    prompt: |
      Evaluate {{ name }}'s application.
      Experience: {{ experience_years }} years.
      Return JSON: {"score": <0-100>, "recommendation": "<hire|reject|maybe>"}
    output:
      format: json
      map:
        score: score
        recommendation: recommendation
      signal_from: recommendation   # route by LLM output
    retry:
      attempts: 3
      on: [parse_error, timeout]
    timeout: 30
  routes:
    hire:   "send_offer"
    reject: "send_rejection"
    maybe:  "manual_review"
    error:  "handle_error"
```

**Signals:** `default`, `error`, `timeout`, `parse_error`, or any value from `signal_from`.

---

## Router

**UI colour:** :material-circle:{ style="color:#f59e0b" } Amber — `border-amber-600 bg-amber-950`

Evaluate a condition on the context dictionary and branch `"true"` / `"false"`. Chain routers for multi-way branching.

```yaml
- id: "check_score"
  kind: "Router"
  condition:
    field: "score"          # context key (dot-path supported: "candidate.score")
    operator: "gte"         # eq | neq | gt | gte | lt | lte | in | contains | is_empty | is_not_empty
    value: 70
  routes:
    "true":  "send_offer"
    "false": "send_rejection"
```

**Signals:** `"true"`, `"false"`, `"error"`.

---

## APICall

**UI colour:** :material-circle:{ style="color:#14b8a6" } Teal — `border-teal-600 bg-teal-950`

Make an outbound HTTP request. Supports `{{ context }}` templating in URL, headers, and body.

```yaml
- id: "enrich_company"
  kind: "APICall"
  http:
    url: "https://api.clearbit.com/v2/companies/find?domain={{ email_domain }}"
    method: "GET"
    headers:
      Authorization: "Bearer ${CLEARBIT_API_KEY}"
    timeout: 15
  response:
    output_key: "company_data"     # full response body stored here
    extract:
      - path: "name"
        as: "company_name"
      - path: "metrics.employees"
        as: "company_size"
  routes:
    default: "next_step"
    error:   "fallback"
```

On HTTP errors: sets `_last_error` and `_api_status_code` in context, emits `"error"`.

**Signals:** `default`, `error`.

---

## MCP

**UI colour:** :material-circle:{ style="color:#ec4899" } Pink — `border-pink-600 bg-pink-950`

Call a tool on any [Model Context Protocol](https://modelcontextprotocol.io) server. Supports SSE and stdio transports.

=== "SSE"

    ```yaml
    - id: "search_kb"
      kind: "MCP"
      mcp:
        transport: "sse"                         # default
        url: "http://localhost:3001/sse"
        tool: "search"
        arguments:
          query: "{{ user_query }}"
      response:
        output_key: "kb_results"
        extract:
          - path: "0.content"
            as: "top_result"
    ```

=== "stdio"

    ```yaml
    - id: "list_prs"
      kind: "MCP"
      mcp:
        transport: "stdio"
        command: "npx"
        args: ["@modelcontextprotocol/server-github"]
        env:
          GITHUB_TOKEN: "{{ github_token }}"
        tool: "list_pull_requests"
        arguments:
          owner: "{{ repo_owner }}"
          repo:  "{{ repo_name }}"
      response:
        output_key: "pull_requests"
    ```

**Signals:** `default`, `error`.

---

## ModelOp

**UI colour:** :material-circle:{ style="color:#10b981" } Emerald — `border-emerald-600 bg-emerald-950`

Direct CRUD on any registered model — no Python node required. The model must be declared in the workflow's `context:` field.

```yaml
- id: "save_candidate"
  kind: "ModelOp"
  model: "Candidate"
  operation: "create"              # create | read | list | update | delete
  payload: "{{ candidate }}"       # dict or {{template}} — used by create / update
  output: "saved_candidate"        # context key for the result

- id: "fetch_with_relations"
  kind: "ModelOp"
  model: "Application"
  operation: "read"
  record_id: "{{ application_id }}"
  include: "candidate,education"   # comma-separated relation names
  output: "application"

- id: "list_pending"
  kind: "ModelOp"
  model: "Application"
  operation: "list"
  filters:
    status: "pending"
  limit: 50
  output: "pending_list"
```

**Signals:** `default`, `error`.

---

## Response

**UI colour:** :material-circle:{ style="color:#ef4444" } Red — `border-red-500 bg-red-950`

Shape the HTTP response body. Usually placed as the last step. The payload is stored in `context["_response"]` and returned verbatim to the API caller.

=== "source"

    ```yaml
    - id: "respond"
      kind: "Response"
      source: "saved_candidate"   # expose an existing context key as-is
    ```

=== "mapping"

    ```yaml
    - id: "respond"
      kind: "Response"
      mapping:
        id:         "saved_candidate.id"
        name:       "saved_candidate.name"
        score:      "evaluation.score"
        next_step:  "evaluation.recommendation"
    ```

**Signals:** `default`, `error`.

---

## HumanInTheLoop

**UI colour:** :material-circle:{ style="color:#f97316" } Orange — `border-orange-500 bg-orange-950`

Suspend the workflow and hand off to a human reviewer. The engine persists a `SystemWorkflowInstance` snapshot and returns HTTP **202 Accepted** with a `hitl_request` payload. Execution resumes when the reviewer submits their response.

```yaml
- id: "approve_application"
  kind: "HumanInTheLoop"
  ui:
    title: "Review Application"
    instruction: "Approve or reject {{ name }}'s application for {{ role }}."
    display_context:            # allowlist of context keys shown to reviewer
      - name
      - role
      - cv_summary
      - score
  human_feedback:
    - name: approved
      type: boolean
      required: true
      label: "Approve?"
    - name: notes
      type: string
      label: "Reviewer notes"
  output_key: "approval_result"  # merged into context under this key on resume
  auth:
    required_group: "hr_manager"
    assignee_user:  "{{ assigned_reviewer }}"
```

Resume endpoint:

```http
POST /hitl/{instance_id}/respond
Content-Type: application/json

{ "approved": true, "notes": "Strong candidate." }
```

**Signals:** *(suspends — does not pass through routes)*

---

## Writing a `Functional` Node



## The `@node` Decorator

The decorator registers your function in the global `NODE_REGISTRY`:

```python
from tuvl.core.nodes.base import node, NODE_REGISTRY

@node("my_node")
async def my_node(ctx):
    return ctx

# The function is now accessible as:
# NODE_REGISTRY["my_node"]
```

!!! warning "Unique Names"
    Node names must be unique. Registering a duplicate name raises a `ValueError`.

## Return Values

Nodes can return values in three formats:

### 1. Return Context Dict

Most common — return the modified context:

```python
@node("enrich_data")
async def enrich_data(ctx: dict[str, Any]) -> dict[str, Any]:
    ctx["enriched"] = True
    ctx["timestamp"] = datetime.now().isoformat()
    return ctx
```

The workflow continues with `"default"` signal.

### 2. Return Signal String

Return a routing signal to control flow:

```python
@node("validate")
async def validate(ctx: dict[str, Any]) -> str:
    if not ctx.get("email"):
        return "invalid"
    if "@" not in ctx["email"]:
        return "invalid"
    return "valid"
```

Use with routes:

```yaml
- id: "validate"
  kind: "Functional"
  runner: "validate"
  routes:
    valid: "save"
    invalid: "reject"
```

### 3. Return Tuple (Context, Signal)

Update context AND specify routing:

```python
@node("process_order")
async def process_order(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    try:
        ctx["order_id"] = create_order(ctx)
        ctx["status"] = "created"
        return ctx, "success"
    except InsufficientStock:
        ctx["error"] = "Out of stock"
        return ctx, "out_of_stock"
```

## Accessing the Database

The engine injects two database helpers into the context:

- `ctx["_db"]` — a `WorkflowUoW` that gates access to the models declared in the workflow's `context:` field (recommended).
- `ctx["_session"]` — the raw `AsyncSession` for advanced use-cases (pass to `get_repository` if you need access to a model outside the workflow context).

### Using `_db` (recommended)

```python
from tuvl.core.nodes.base import node

@node("save_contact")
async def save_contact(ctx: dict) -> dict:
    repo = ctx["_db"]["Contact"]   # WorkflowUoW — model must be in workflow's context:
    
    contact = await repo.add({
        "email": ctx["email"],
        "name": ctx["name"],
    })
    
    ctx["id"] = str(contact.id)
    return ctx
```

### Using `get_repository` directly

Use this when you need to access a model that is not declared in the workflow's `context:` field:

```python
from tuvl.core.nodes.base import node
from tuvl.core.repositories.registry import get_repository

@node("save_contact")
async def save_contact(ctx: dict) -> dict:
    session = ctx["_session"]
    repo = get_repository("Contact", session)
    
    contact = await repo.add({
        "email": ctx["email"],
        "name": ctx["name"],
    })
    
    ctx["id"] = str(contact.id)
    return ctx
```

### Repository Methods

| Method | Description |
|--------|-------------|
| `await repo.add(data)` | Create a new record |
| `await repo.get(id)` | Fetch by primary key |
| `await repo.list(criteria, limit, offset)` | Query with filters |
| `await repo.update(id, data)` | Partial update |
| `await repo.remove(id)` | Delete a record |

### Querying Data

```python
@node("find_duplicates")
async def find_duplicates(ctx: dict) -> dict:
    repo = ctx["_db"]["Contact"]
    
    existing = await repo.list(
        criteria={"email": ctx["email"]},
        limit=1
    )
    
    ctx["is_duplicate"] = len(existing) > 0
    return ctx
```

## Error Handling

### Graceful Error Handling

Handle expected errors and return signals:

```python
@node("external_api")
async def external_api(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    try:
        response = await httpx.get(f"https://api.example.com/{ctx['id']}")
        response.raise_for_status()
        ctx["api_data"] = response.json()
        return ctx, "success"
    except httpx.HTTPStatusError as e:
        ctx["_last_error"] = f"API error: {e.response.status_code}"
        return ctx, "error"
    except httpx.RequestError as e:
        ctx["_last_error"] = f"Network error: {str(e)}"
        return ctx, "retry"
```

### Raising Exceptions

Unhandled exceptions stop the workflow and trigger rollback:

```python
@node("critical_step")
async def critical_step(ctx: dict[str, Any]) -> dict[str, Any]:
    if not ctx.get("required_field"):
        raise ValueError("required_field is missing")
    return ctx
```

The workflow engine will:

1. Log the error
2. Set `_last_error` in context
3. Check for an `error` route
4. Roll back the database transaction if no error route

## Async Operations

Nodes are async by default. Use `await` for I/O operations:

```python
import httpx

@node("fetch_user_data")
async def fetch_user_data(ctx: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.example.com/users/{ctx['user_id']}"
        )
        ctx["user_profile"] = response.json()
    return ctx
```

### Parallel Operations

Use `asyncio.gather` for concurrent tasks:

```python
import asyncio

@node("enrich_all")
async def enrich_all(ctx: dict[str, Any]) -> dict[str, Any]:
    tasks = [
        fetch_company_info(ctx["company"]),
        fetch_social_profiles(ctx["email"]),
        fetch_credit_score(ctx["ssn"]),
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    ctx["company_info"] = results[0] if not isinstance(results[0], Exception) else None
    ctx["social"] = results[1] if not isinstance(results[1], Exception) else None
    ctx["credit"] = results[2] if not isinstance(results[2], Exception) else None
    
    return ctx
```

## Node Organization

### File Structure

Organize nodes by domain:

```
nodes/
├── contacts.py      # Contact-related nodes
├── orders.py        # Order processing nodes
├── notifications.py # Email, SMS, push notifications
└── integrations.py  # External API integrations
```

### Auto-Discovery

tuvl automatically imports all `.py` files from the project's `nodes/` directory at startup — no `__init__.py` required. Every `@node()`-decorated function in those files is registered in `NODE_REGISTRY` and becomes available to workflow steps.

## Utility Functions

Keep node functions focused. Extract utilities:

```python
# nodes/utils/email.py
async def send_email(to: str, subject: str, body: str) -> bool:
    ...

# nodes/notifications.py
from .utils.email import send_email

@node("send_welcome_email")
async def send_welcome_email(ctx: dict[str, Any]) -> dict[str, Any]:
    success = await send_email(
        to=ctx["email"],
        subject="Welcome!",
        body=f"Hello {ctx['name']}, welcome aboard!"
    )
    ctx["email_sent"] = success
    return ctx
```

## Testing Nodes

Nodes are simple async functions — easy to test:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

from nodes.contacts import save_contact

@pytest.mark.asyncio
async def test_save_contact():
    # Mock the session and repository
    mock_session = AsyncMock()
    mock_repo = AsyncMock()
    mock_repo.add.return_value = MagicMock(id="test-uuid")
    
    with patch("nodes.contacts.get_repository", return_value=mock_repo):
        ctx = {
            "_session": mock_session,
            "email": "test@example.com",
            "name": "Test User",
        }
        
        result = await save_contact(ctx)
        
        assert result["id"] == "test-uuid"
        mock_repo.add.assert_called_once()
```

## Common Patterns

### Validation Node

```python
@node("validate_input")
async def validate_input(ctx: dict[str, Any]) -> str:
    errors = []
    
    if not ctx.get("email"):
        errors.append("Email is required")
    elif "@" not in ctx["email"]:
        errors.append("Invalid email format")
    
    if not ctx.get("name"):
        errors.append("Name is required")
    
    if errors:
        ctx["validation_errors"] = errors
        return "invalid"
    
    return "valid"
```

### Transformation Node

```python
@node("normalize_data")
async def normalize_data(ctx: dict[str, Any]) -> dict[str, Any]:
    ctx["email"] = ctx.get("email", "").lower().strip()
    ctx["name"] = ctx.get("name", "").title().strip()
    ctx["phone"] = re.sub(r"[^\d+]", "", ctx.get("phone", ""))
    return ctx
```

### Conditional Logic Node

```python
@node("route_by_amount")
async def route_by_amount(ctx: dict[str, Any]) -> str:
    amount = ctx.get("amount", 0)
    
    if amount > 10000:
        return "high_value"
    elif amount > 1000:
        return "medium_value"
    else:
        return "low_value"
```

### Notification Node

```python
@node("send_notification")
async def send_notification(ctx: dict[str, Any]) -> dict[str, Any]:
    notifications_sent = []
    
    if ctx.get("email"):
        await send_email(ctx["email"], "Update", ctx["message"])
        notifications_sent.append("email")
    
    if ctx.get("phone"):
        await send_sms(ctx["phone"], ctx["message"])
        notifications_sent.append("sms")
    
    ctx["notifications_sent"] = notifications_sent
    return ctx
```

## Next Steps

- [Repositories](repositories.md) — Working with data
- [Workflows](workflows.md) — Using nodes in workflows
- [Examples](../examples/custom-nodes.md) — More node examples
