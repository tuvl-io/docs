# Repositories

Repositories provide a clean interface for database operations within workflow nodes.

## Overview

The recommended way to access repositories in nodes is through `ctx["_db"]`, a `WorkflowUoW` object that routes each model to the correct datasource and enforces that only models declared in the workflow's `context:` field are accessible:

```python
from tuvl.core.nodes.base import node

@node("save_order")
async def save_order(ctx: dict) -> dict:
    repo = ctx["_db"]["Order"]   # model must be listed in workflow's context:
    
    order = await repo.add({
        "customer_id": ctx["customer_id"],
        "total": ctx["total"],
    })
    
    ctx["order_id"] = str(order.id)
    return ctx
```

For cases where you need a model outside the workflow context (or need the raw session), use `get_repository()` directly:

```python
from tuvl.core.repositories.registry import get_repository

repo = get_repository("Order", ctx["_session"])
```

## Getting a Repository

### Via `_db` (recommended)

```python
repo = ctx["_db"]["Contact"]    # raises PermissionError if model not in context:
```

### Via `get_repository`

```python
from tuvl.core.repositories.registry import get_repository

repo = get_repository("Contact", ctx["_session"])
```

## CRUD Operations

### Create

```python
# Add a single record
contact = await repo.add({
    "email": "jane@example.com",
    "name": "Jane Doe",
    "company": "Acme Inc",
})

# Returns the created entity with generated fields (id, created_at, etc.)
print(contact.id)  # UUID
print(contact.email)  # "jane@example.com"
```

### Read Single

```python
# Get by primary key
contact = await repo.get(uuid.UUID("550e8400-e29b-41d4-a716-446655440000"))

if contact:
    print(contact.name)
else:
    print("Not found")
```

### Read Multiple

```python
# List all (with pagination)
contacts = await repo.list(limit=10, offset=0)

# Filter by criteria
acme_contacts = await repo.list(
    criteria={"company": "Acme Inc"},
    limit=50
)

# Multiple criteria (AND)
senior_devs = await repo.list(
    criteria={
        "department": "Engineering",
        "level": "Senior"
    }
)
```

### Update

```python
# Partial update by ID
updated = await repo.update(
    contact_id,
    {"company": "New Company Name"}
)

if updated:
    print(f"Updated: {updated.company}")
else:
    print("Not found")
```

### Delete

```python
# Delete by ID
deleted = await repo.remove(contact_id)

if deleted:
    print("Contact deleted")
else:
    print("Contact not found")
```

## Method Reference

### `add(entity_data: dict) -> T`

Create a new record.

```python
order = await repo.add({
    "customer_id": customer_id,
    "items": items_json,
    "total": 99.99,
})
```

!!! note
    The record is flushed but not committed. Commit happens automatically at the end of the workflow.

### `get(ident: Any) -> Optional[T]`

Retrieve a single record by primary key.

```python
order = await repo.get(order_id)
if not order:
    raise ValueError("Order not found")
```

### `list(criteria, limit, offset) -> List[T]`

Query records with optional filters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `criteria` | `dict` | `None` | Filter conditions (AND) |
| `limit` | `int` | `100` | Maximum records to return |
| `offset` | `int` | `0` | Number of records to skip |

```python
# Pagination
page_1 = await repo.list(limit=20, offset=0)
page_2 = await repo.list(limit=20, offset=20)

# Filtered query
pending = await repo.list(
    criteria={"status": "pending"},
    limit=50
)
```

### `update(ident: Any, data: dict) -> Optional[T]`

Update specific fields on a record.

```python
updated = await repo.update(order_id, {
    "status": "shipped",
    "shipped_at": datetime.now(),
})
```

!!! tip
    Only include fields you want to change. Other fields remain unchanged.

### `remove(ident: Any) -> bool`

Delete a record by primary key.

```python
if await repo.remove(order_id):
    ctx["message"] = "Order cancelled"
else:
    ctx["error"] = "Order not found"
```

## Transaction Handling

The workflow manager handles transactions automatically:

```python
async def _run_engine(config, context, session):
    try:
        engine = WorkflowEngine(config)
        final_context = await engine.run(context)
        await session.commit()   # ✓ Commit on success
    except Exception:
        await session.rollback()  # ✗ Rollback on error
        raise
```

Within nodes, just use `await repo.add()`, `await repo.update()`, etc. Don't call `commit()` manually.

## Multiple Repositories

Access multiple models in a single node:

```python
@node("create_order_with_items")
async def create_order_with_items(ctx: dict) -> dict:
    order_repo = ctx["_db"]["Order"]
    item_repo = ctx["_db"]["OrderItem"]
    
    # Create order
    order = await order_repo.add({
        "customer_id": ctx["customer_id"],
        "total": ctx["total"],
    })
    
    # Create items
    for item in ctx["items"]:
        await item_repo.add({
            "order_id": order.id,
            "product_id": item["product_id"],
            "quantity": item["quantity"],
        })
    
    ctx["order_id"] = str(order.id)
    return ctx
```

## Error Handling

### Record Not Found

```python
@node("update_contact")
async def update_contact(ctx: dict[str, Any]) -> tuple[dict, str]:
    session = ctx["_session"]
    repo = get_repository("Contact", session)
    
    updated = await repo.update(ctx["contact_id"], {
        "status": ctx["new_status"]
    })
    
    if not updated:
        ctx["error"] = "Contact not found"
        return ctx, "not_found"
    
    return ctx, "success"
```

### Constraint Violations

```python
from sqlalchemy.exc import IntegrityError

@node("create_user")
async def create_user(ctx: dict[str, Any]) -> tuple[dict, str]:
    session = ctx["_session"]
    repo = get_repository("User", session)
    
    try:
        user = await repo.add({
            "email": ctx["email"],
            "username": ctx["username"],
        })
        ctx["user_id"] = str(user.id)
        return ctx, "success"
    except IntegrityError:
        ctx["error"] = "Email or username already exists"
        return ctx, "duplicate"
```

## Advanced Queries

For complex queries not supported by `list()`, access the model class directly:

```python
from sqlmodel import select, or_

@node("search_contacts")
async def search_contacts(ctx: dict[str, Any]) -> dict[str, Any]:
    session = ctx["_session"]
    
    # Get model class from registry
    from tuvl.core.models.loader import MODEL_REGISTRY
    Contact = MODEL_REGISTRY["Contact"]
    
    # Custom query
    query = ctx.get("search_query", "")
    statement = select(Contact).where(
        or_(
            Contact.name.ilike(f"%{query}%"),
            Contact.email.ilike(f"%{query}%"),
            Contact.company.ilike(f"%{query}%"),
        )
    ).limit(20)
    
    result = await session.exec(statement)
    contacts = result.all()
    
    ctx["results"] = [c.model_dump() for c in contacts]
    return ctx
```

## Best Practices

### 1. Always Check Return Values

```python
# Good
contact = await repo.get(contact_id)
if not contact:
    return ctx, "not_found"

# Avoid
contact = await repo.get(contact_id)  # Might be None!
ctx["name"] = contact.name  # AttributeError if None
```

### 2. Use Specific Criteria

```python
# Good - specific query
contacts = await repo.list(
    criteria={"company": company, "status": "active"},
    limit=100
)

# Avoid - fetching all records
all_contacts = await repo.list(limit=10000)
active = [c for c in all_contacts if c.status == "active"]
```

### 3. Handle Constraints

```python
# Good - handle integrity errors
try:
    await repo.add(data)
except IntegrityError as e:
    if "unique" in str(e).lower():
        return ctx, "duplicate"
    raise
```

### 4. Don't Commit Manually

```python
# Good - let workflow manager handle it
await repo.add(data)
return ctx

# Avoid - manual commit
await repo.add(data)
await session.commit()  # Don't do this!
```

## Testing Repositories

Mock repositories in unit tests:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_save_contact():
    mock_repo = AsyncMock()
    mock_repo.add.return_value = MagicMock(
        id=uuid.uuid4(),
        email="test@example.com"
    )
    
    with patch("nodes.contacts.get_repository", return_value=mock_repo):
        ctx = {
            "_session": AsyncMock(),
            "email": "test@example.com",
            "name": "Test"
        }
        
        result = await save_contact(ctx)
        
        assert "id" in result
        mock_repo.add.assert_called_once()
```

## Next Steps

- [Models](models.md) — Defining data structures
- [Nodes](nodes.md) — Using repositories in nodes
- [Workflows](workflows.md) — Building complete workflows
