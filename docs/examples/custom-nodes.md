# Example: Custom Nodes

A collection of common node patterns and implementations.

## Basic Patterns

### Validation Node

```python
from typing import Any
from tuvl_engine.nodes.base import node

@node("validate_email")
async def validate_email(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Validate email format and uniqueness."""
    import re
    
    email = ctx.get("email", "")
    
    # Format validation
    if not email:
        ctx["validation_error"] = "Email is required"
        return ctx, "invalid"
    
    if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        ctx["validation_error"] = "Invalid email format"
        return ctx, "invalid"
    
    # Uniqueness check
    session = ctx["_session"]
    from tuvl_engine.repositories.registry import get_repository
    repo = get_repository("User", session)
    
    existing = await repo.list(criteria={"email": email}, limit=1)
    if existing:
        ctx["validation_error"] = "Email already registered"
        return ctx, "duplicate"
    
    return ctx, "valid"
```

Use in workflow:

```yaml
- id: "validate"
  kind: "Functional"
  runner: "validate_email"
  routes:
    valid: "create_user"
    invalid: "reject"
    duplicate: "merge_accounts"
```

### Data Transformation Node

```python
@node("normalize_contact")
async def normalize_contact(ctx: dict[str, Any]) -> dict[str, Any]:
    """Normalize and clean contact data."""
    
    # Normalize email
    if "email" in ctx:
        ctx["email"] = ctx["email"].lower().strip()
    
    # Normalize name
    if "name" in ctx:
        ctx["name"] = ctx["name"].title().strip()
    
    # Clean phone number
    if "phone" in ctx:
        import re
        ctx["phone"] = re.sub(r"[^\d+]", "", ctx["phone"])
        ctx["phone_formatted"] = format_phone(ctx["phone"])
    
    # Parse address
    if "address" in ctx:
        ctx["address_parts"] = parse_address(ctx["address"])
    
    return ctx
```

### Conditional Logic Node

```python
@node("route_by_value")
async def route_by_value(ctx: dict[str, Any]) -> str:
    """Route based on order value."""
    
    amount = ctx.get("total_amount", 0)
    customer_type = ctx.get("customer_type", "regular")
    
    if amount > 10000:
        return "high_value"
    elif customer_type == "vip":
        return "vip_processing"
    elif amount > 1000:
        return "standard"
    else:
        return "express"
```

## Database Operations

### Bulk Insert Node

```python
@node("bulk_import")
async def bulk_import(ctx: dict[str, Any]) -> dict[str, Any]:
    """Import multiple records from a list."""
    
    session = ctx["_session"]
    from tuvl_engine.repositories.registry import get_repository
    repo = get_repository("Contact", session)
    
    items = ctx.get("items", [])
    imported_ids = []
    errors = []
    
    for item in items:
        try:
            record = await repo.add(item)
            imported_ids.append(str(record.id))
        except Exception as e:
            errors.append({
                "item": item,
                "error": str(e)
            })
    
    ctx["imported_count"] = len(imported_ids)
    ctx["imported_ids"] = imported_ids
    ctx["error_count"] = len(errors)
    ctx["errors"] = errors
    
    return ctx
```

### Search Node

```python
@node("search_records")
async def search_records(ctx: dict[str, Any]) -> dict[str, Any]:
    """Search with multiple criteria."""
    
    session = ctx["_session"]
    from sqlmodel import select, or_, and_
    from tuvl_engine.models.loader import MODEL_REGISTRY
    
    Contact = MODEL_REGISTRY["Contact"]
    query = ctx.get("query", "")
    
    # Build search statement
    statement = select(Contact).where(
        or_(
            Contact.name.ilike(f"%{query}%"),
            Contact.email.ilike(f"%{query}%"),
            Contact.company.ilike(f"%{query}%"),
        )
    ).limit(ctx.get("limit", 20))
    
    result = await session.exec(statement)
    contacts = result.all()
    
    ctx["results"] = [c.model_dump() for c in contacts]
    ctx["result_count"] = len(contacts)
    
    return ctx
```

### Transaction Node

```python
@node("transfer_funds")
async def transfer_funds(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Transfer funds between accounts."""
    
    session = ctx["_session"]
    from tuvl_engine.repositories.registry import get_repository
    
    account_repo = get_repository("Account", session)
    
    source = await account_repo.get(ctx["from_account_id"])
    dest = await account_repo.get(ctx["to_account_id"])
    amount = ctx["amount"]
    
    if not source or not dest:
        ctx["error"] = "Account not found"
        return ctx, "error"
    
    if source.balance < amount:
        ctx["error"] = "Insufficient funds"
        return ctx, "insufficient_funds"
    
    # Perform transfer (both updates in same transaction)
    await account_repo.update(source.id, {
        "balance": source.balance - amount
    })
    await account_repo.update(dest.id, {
        "balance": dest.balance + amount
    })
    
    ctx["new_source_balance"] = source.balance - amount
    ctx["new_dest_balance"] = dest.balance + amount
    ctx["transfer_id"] = generate_transfer_id()
    
    return ctx, "success"
```

## External Services

### HTTP Request Node

```python
import httpx

@node("call_external_api")
async def call_external_api(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Make authenticated API request."""
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.example.com/process",
                json={
                    "data": ctx["payload"]
                },
                headers={
                    "Authorization": f"Bearer {ctx.get('api_key', '')}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            response.raise_for_status()
            
            ctx["api_response"] = response.json()
            return ctx, "success"
            
        except httpx.HTTPStatusError as e:
            ctx["api_error"] = f"HTTP {e.response.status_code}"
            return ctx, "api_error"
            
        except httpx.RequestError as e:
            ctx["api_error"] = str(e)
            return ctx, "network_error"
```

### Email Node

```python
import aiosmtplib
from email.message import EmailMessage

@node("send_email")
async def send_email(ctx: dict[str, Any]) -> dict[str, Any]:
    """Send email notification."""
    
    message = EmailMessage()
    message["From"] = ctx.get("from_email", "noreply@example.com")
    message["To"] = ctx["to_email"]
    message["Subject"] = ctx["subject"]
    message.set_content(ctx["body"])
    
    try:
        await aiosmtplib.send(
            message,
            hostname=ctx.get("smtp_host", "localhost"),
            port=ctx.get("smtp_port", 587),
            start_tls=True,
            username=ctx.get("smtp_user"),
            password=ctx.get("smtp_password"),
        )
        ctx["email_sent"] = True
    except Exception as e:
        ctx["email_sent"] = False
        ctx["email_error"] = str(e)
    
    return ctx
```

### Webhook Node

```python
@node("send_webhook")
async def send_webhook(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Send webhook notification."""
    
    import httpx
    import hmac
    import hashlib
    import json
    
    payload = {
        "event": ctx["event_type"],
        "data": ctx["event_data"],
        "timestamp": datetime.now().isoformat()
    }
    
    # Sign payload
    secret = ctx.get("webhook_secret", "")
    signature = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                ctx["webhook_url"],
                json=payload,
                headers={
                    "X-Signature": signature,
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            ctx["webhook_status"] = response.status_code
            ctx["webhook_sent"] = response.status_code < 400
            
            return ctx, "success" if ctx["webhook_sent"] else "failed"
            
        except Exception as e:
            ctx["webhook_error"] = str(e)
            return ctx, "error"
```

## File Operations

### File Upload Handler

```python
import aiofiles
from pathlib import Path

@node("save_uploaded_file")
async def save_uploaded_file(ctx: dict[str, Any]) -> dict[str, Any]:
    """Save uploaded file and extract metadata."""
    
    import hashlib
    
    file_data = ctx["file_content"]  # Base64 or bytes
    filename = ctx["filename"]
    
    # Generate unique filename
    file_hash = hashlib.md5(file_data).hexdigest()[:8]
    safe_name = f"{file_hash}_{filename}"
    
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    file_path = upload_dir / safe_name
    
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_data)
    
    ctx["file_path"] = str(file_path)
    ctx["file_size"] = len(file_data)
    ctx["file_hash"] = file_hash
    
    return ctx
```

## Utilities

### Logging Node

```python
import logging

logger = logging.getLogger(__name__)

@node("log_context")
async def log_context(ctx: dict[str, Any]) -> dict[str, Any]:
    """Log context for debugging."""
    
    # Filter sensitive keys
    safe_ctx = {
        k: v for k, v in ctx.items()
        if not k.startswith("_") and k not in ["password", "token", "secret"]
    }
    
    logger.info(f"Context at {ctx.get('_step', 'unknown')}: {safe_ctx}")
    
    return ctx
```

### Timing Node

```python
import time

@node("measure_time")
async def measure_time(ctx: dict[str, Any]) -> dict[str, Any]:
    """Measure execution time of workflow section."""
    
    if "_start_time" not in ctx:
        ctx["_start_time"] = time.time()
    else:
        elapsed = time.time() - ctx["_start_time"]
        ctx["execution_time_seconds"] = round(elapsed, 3)
        del ctx["_start_time"]
    
    return ctx
```

### Rate Limiter Node

```python
import asyncio
from collections import defaultdict

# Simple in-memory rate limiter (use Redis in production)
_rate_limits = defaultdict(list)

@node("rate_limit")
async def rate_limit(ctx: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Apply rate limiting per user."""
    
    user_id = ctx.get("user_id", "anonymous")
    limit = ctx.get("rate_limit", 10)  # requests per minute
    window = 60  # seconds
    
    now = time.time()
    
    # Clean old entries
    _rate_limits[user_id] = [
        t for t in _rate_limits[user_id]
        if now - t < window
    ]
    
    if len(_rate_limits[user_id]) >= limit:
        ctx["rate_limited"] = True
        ctx["retry_after"] = window - (now - _rate_limits[user_id][0])
        return ctx, "rate_limited"
    
    _rate_limits[user_id].append(now)
    ctx["rate_limited"] = False
    
    return ctx, "allowed"
```

## Testing Nodes

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_validate_email_valid():
    ctx = {
        "_session": AsyncMock(),
        "email": "test@example.com"
    }
    
    mock_repo = AsyncMock()
    mock_repo.list.return_value = []
    
    with patch("nodes.validation.get_repository", return_value=mock_repo):
        result, signal = await validate_email(ctx)
    
    assert signal == "valid"
    assert "validation_error" not in result


@pytest.mark.asyncio
async def test_validate_email_invalid_format():
    ctx = {
        "_session": AsyncMock(),
        "email": "not-an-email"
    }
    
    result, signal = await validate_email(ctx)
    
    assert signal == "invalid"
    assert "validation_error" in result


@pytest.mark.asyncio
async def test_validate_email_duplicate():
    ctx = {
        "_session": AsyncMock(),
        "email": "existing@example.com"
    }
    
    mock_repo = AsyncMock()
    mock_repo.list.return_value = [MagicMock()]  # Existing user
    
    with patch("nodes.validation.get_repository", return_value=mock_repo):
        result, signal = await validate_email(ctx)
    
    assert signal == "duplicate"
```

## Next Steps

- [Nodes](../concepts/nodes.md) — Node concepts
- [Workflows](../concepts/workflows.md) — Using nodes in workflows
- [Candidate Onboarding](candidate-onboarding.md) — Complete example
