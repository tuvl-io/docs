# Nodes

Nodes are Python functions that execute workflow steps. They receive a context dictionary and return an updated context or routing signal.

## Basic Node

```python
from typing import Any
from tuvl_engine.nodes.base import node

@node("greet_user")
async def greet_user(ctx: dict[str, Any]) -> dict[str, Any]:
    """Add a greeting message to the context."""
    ctx["greeting"] = f"Hello, {ctx.get('name', 'Guest')}!"
    return ctx
```

Use it in a workflow:

```yaml
steps:
  - id: "greet"
    kind: "functional"
    runner: "greet_user"
```

## The `@node` Decorator

The decorator registers your function in the global `NODE_REGISTRY`:

```python
from tuvl_engine.nodes.base import node, NODE_REGISTRY

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
  kind: "functional"
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

The workflow manager injects `_session` into the context:

```python
from tuvl_engine.nodes.base import node
from tuvl_engine.repositories.registry import get_repository

@node("save_contact")
async def save_contact(ctx: dict[str, Any]) -> dict[str, Any]:
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
async def find_duplicates(ctx: dict[str, Any]) -> dict[str, Any]:
    session = ctx["_session"]
    repo = get_repository("Contact", session)
    
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
├── __init__.py
├── contacts.py      # Contact-related nodes
├── orders.py        # Order processing nodes
├── notifications.py # Email, SMS, push notifications
└── integrations.py  # External API integrations
```

### Import Registration

Create an `__init__.py` that imports all modules:

```python title="nodes/__init__.py"
from . import contacts
from . import orders
from . import notifications
from . import integrations
```

This ensures all nodes are registered when the package is imported.

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
