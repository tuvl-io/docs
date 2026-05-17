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

tuvl has a built-in IAM system based on Biscuit tokens. All `/auth/*` endpoints are
served under the prefix `/auth`. See [IAM](../security/iam.md) and
[Tokens](../security/tokens.md) for full documentation.

### Bootstrap

One-time setup to create the first superadmin user. Disabled once any admin exists.

```
POST /auth/bootstrap
```

```json title="Request"
{
  "email": "admin@example.com",
  "password": "changeme"
}
```

```json title="Response 200"
{
  "message": "Bootstrap complete",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Login

Standard OAuth2 password grant. Returns a Biscuit bearer token.

```
POST /auth/token
Content-Type: application/x-www-form-urlencoded
```

```
username=admin@example.com&password=changeme&grant_type=password
```

```json title="Response 200"
{
  "access_token": "<biscuit-token>",
  "token_type": "bearer",
  "expires_in": 86400
}
```

Use the token in subsequent requests:

```http
Authorization: Bearer <biscuit-token>
```

### Refresh Token

Exchange a valid token for a new one (old token is revoked):

```
POST /auth/refresh
Authorization: Bearer <current-token>
```

```json title="Response 200"
{
  "access_token": "<new-biscuit-token>",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Logout

Revoke the current token immediately:

```
POST /auth/logout
Authorization: Bearer <token>
```

Response: `204 No Content`

### Admin — Users

Requires scope `iam:admin`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/admin/users` | List all users |
| `POST` | `/auth/admin/users` | Create a user |
| `GET` | `/auth/admin/users/{id}` | Get a user |
| `PATCH` | `/auth/admin/users/{id}` | Update email / password / active |
| `DELETE` | `/auth/admin/users/{id}` | Delete a user |

```json title="POST /auth/admin/users – request"
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

```json title="PATCH /auth/admin/users/{id} – request"
{
  "email": "new@example.com",
  "password": "newpassword",
  "is_active": false
}
```

### Admin — Roles

Requires scope `iam:admin`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/admin/roles` | List all roles |
| `POST` | `/auth/admin/roles` | Create a role |
| `DELETE` | `/auth/admin/roles/{id}` | Delete a role |
| `PATCH` | `/auth/admin/roles/{id}/scopes` | Add or remove scopes |

```json title="POST /auth/admin/roles – request"
{
  "name": "analyst",
  "description": "Read-only analyst access"
}
```

```json title="PATCH /auth/admin/roles/{id}/scopes – request"
{
  "add": ["data:read", "models:read"],
  "remove": ["iam:admin"]
}
```

### Admin — Role Assignments

Requires scope `iam:admin`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/admin/users/{user_id}/roles/{role_id}` | Assign role to user |
| `DELETE` | `/auth/admin/users/{user_id}/roles/{role_id}` | Remove role from user |

### OAuth2 Federation

Social login via configured providers. See [Federation](../security/federation.md).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/oauth/{provider}/start` | Redirect to provider |
| `GET` | `/auth/oauth/{provider}/callback` | OAuth2 callback (browser) |

```bash
# Start Google sign-in (open in browser)
curl -L http://localhost:8000/auth/oauth/google/start
```

### Admin — Federation Providers

Requires scope `iam:admin`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/admin/federation` | List provider configs |
| `GET` | `/auth/admin/federation/{name}` | Get a provider config |
| `PUT` | `/auth/admin/federation/{name}` | Create / update a provider |
| `DELETE` | `/auth/admin/federation/{name}` | Delete a provider |

### Token in Dev Mode

In dev mode (`tuvl dev`) no `Authorization` header is required. The dev middleware
auto-injects a session key that grants all scopes. You can still pass a real token to
test IAM flows.

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
