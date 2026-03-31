# API Endpoints

tuvl automatically generates REST API endpoints for workflows and models.

## Workflow Endpoints

Workflows with HTTP triggers become API endpoints:

```yaml title="workflows/onboarding.yaml"
trigger:
  path: "/api/onboard"
  method: "POST"
```

This creates:

```
POST /api/onboard
```

### Request Format

```bash
curl -X POST http://localhost:8000/api/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "name": "Jane Doe"
  }'
```

### Response Format

All workflow responses follow this structure:

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "status": "completed"
  },
  "error": null
}
```

### Error Response

```json
{
  "success": false,
  "status_code": 400,
  "data": {
    "email": "jane@example.com"
  },
  "error": {
    "message": "Workflow execution halted",
    "details": "Validation failed: invalid email format"
  }
}
```

## CRUD Endpoints

Each model automatically gets CRUD endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/{model}` | Create record |
| `GET` | `/api/{model}` | List records |
| `GET` | `/api/{model}/{id}` | Get record |
| `PATCH` | `/api/{model}/{id}` | Update record |
| `DELETE` | `/api/{model}/{id}` | Delete record |

### Create

```bash
curl -X POST http://localhost:8000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "name": "Jane Doe",
    "company": "Acme Inc"
  }'
```

Response:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "jane@example.com",
  "name": "Jane Doe",
  "company": "Acme Inc",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### List

```bash
# List all (paginated)
curl http://localhost:8000/api/contact

# With filters
curl "http://localhost:8000/api/contact?company=Acme&limit=10&offset=0"
```

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Max records |
| `offset` | integer | 0 | Skip records |
| `{field}` | varies | - | Filter by field value |

### Get Single

```bash
curl http://localhost:8000/api/contact/550e8400-e29b-41d4-a716-446655440000
```

### Update

```bash
curl -X PATCH http://localhost:8000/api/contact/550e8400-... \
  -H "Content-Type: application/json" \
  -d '{
    "company": "New Company Name"
  }'
```

### Delete

```bash
curl -X DELETE http://localhost:8000/api/contact/550e8400-...
```

## API Documentation

FastAPI auto-generates interactive documentation:

| URL | Format |
|-----|--------|
| `/docs` | Swagger UI |
| `/redoc` | ReDoc |
| `/openapi.json` | OpenAPI spec |

## Authentication

!!! note "Coming Soon"
    Built-in authentication is planned for a future release. Currently, implement authentication at the reverse proxy level or with custom middleware.

### Custom Middleware Example

```python
from fastapi import Request, HTTPException

async def auth_middleware(request: Request, call_next):
    token = request.headers.get("Authorization")
    if not token or not verify_token(token):
        raise HTTPException(status_code=401)
    return await call_next(request)
```

## CORS Configuration

Configure CORS in your FastAPI setup:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Rate Limiting

Implement rate limiting with middleware:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/resource")
@limiter.limit("10/minute")
async def get_resource():
    ...
```

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 404 | Resource not found |
| 422 | Unprocessable entity |
| 500 | Server error |

### Error Response Structure

```json
{
  "success": false,
  "status_code": 400,
  "data": null,
  "error": {
    "message": "Brief error description",
    "details": "Detailed error information"
  }
}
```

## Next Steps

- [Schemas](schemas.md) — API schema reference
- [Workflows](../concepts/workflows.md) — Creating workflows
- [Models](../concepts/models.md) — Defining models
