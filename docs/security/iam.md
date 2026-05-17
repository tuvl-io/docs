# Identity & Access Management (IAM)

tuvl has a built-in IAM system based on **users**, **roles**, and **scopes**. Access tokens are
[Biscuit](https://www.biscuitsec.org/) tokens — cryptographically signed Datalog structures that embed
identity, group membership, and fine-grained permission scopes.

---

## Concepts

### Users

A `User` is a principal that can authenticate with tuvl. Users can use:

- **Password auth** — email + bcrypt-hashed password via `POST /auth/token`
- **Federated auth** — OAuth2 login via Google, GitHub, or Microsoft ([see Federation](federation.md))
- **Both** — a user may link both methods to the same account

### Roles

A `Role` is a named bundle of scopes. Examples:

| Role | Scopes |
|------|--------|
| `superadmin` | `iam:admin` (all admin operations) |
| `hr_manager` | `requisition:write`, `candidate:read` |
| `recruiter` | `candidate:read`, `interview:read` |

### Scopes

Scopes are arbitrary `resource:action` strings that your workflows and endpoints check.
The only built-in scope is `iam:admin`, which gates all `/auth/admin/*` endpoints.

---

## Bootstrap

On a fresh installation with no users, the bootstrap endpoint creates the first superadmin:

```bash
curl -X POST http://localhost:8000/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "change-me-now"
  }'
```

```json
{
  "access_token": "<biscuit_b64>",
  "token_type": "bearer"
}
```

!!! warning "One-time only"
    Bootstrap fails with `409 Conflict` if any user already exists. It is a one-time
    setup operation intended only for empty databases.

---

## Authentication

### Password Login

```http
POST /auth/token
Content-Type: application/x-www-form-urlencoded

username=admin@example.com&password=change-me-now
```

!!! note "OAuth2 form format"
    `/auth/token` follows the OAuth2 password-grant standard — it expects
    `application/x-www-form-urlencoded` with fields `username` and `password`
    (not JSON). This makes it compatible with the Swagger UI **Authorize** button.

Response:

```json
{
  "access_token": "<biscuit_b64>",
  "token_type": "bearer"
}
```

Use the token in subsequent requests:

```bash
curl http://localhost:8000/auth/admin/users \
  -H "Authorization: Bearer <biscuit_b64>"
```

### Token Refresh

Exchange the current token for a new one with a fresh TTL (the old token is immediately revoked):

```bash
curl -X POST http://localhost:8000/auth/refresh \
  -H "Authorization: Bearer <old_token>"
```

Returns a new `TokenResponse`. The old token is added to the blacklist and can no longer be used.

### Logout

Revoke the current token immediately:

```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer <token>"
```

Returns `204 No Content`. The token is added to the blacklist.

---

## Using the TypeScript SDK

The `@tuvl/client` package ships a `TuvlAuth` helper that wraps all `/auth/*`
endpoints — no manual `fetch` required.

### Install

```bash
npm install @tuvl/client
```

### Password login

```ts
import { TuvlAuth, TuvlClient } from "@tuvl/client";

const auth = new TuvlAuth({ baseUrl: "http://localhost:8000" });

const { access_token } = await auth.loginWithPassword("admin@example.com", "secret");

// Attach the token to the workflow client
const client = new TuvlClient({ baseUrl: "http://localhost:8000", token: access_token });
```

### OAuth2 login (browser)

```ts
// 1. Redirect the browser to the provider
const auth = new TuvlAuth({ baseUrl: "http://localhost:8000" });
window.location.href = auth.getOAuthLoginUrl("google");

// 2. After login the server redirects to TUVL_OAUTH_UI_REDIRECT_URL?token=<biscuit>
//    On that landing page, extract the token:
const token = new URLSearchParams(window.location.search).get("token")!;
const client = new TuvlClient({ baseUrl: "http://localhost:8000", token });
```

!!! info "Configure the redirect"
    Set `TUVL_OAUTH_UI_REDIRECT_URL` in your server `.env` to the URL of the page
    that should receive the token after OAuth completes.  Without it the callback
    returns JSON (suitable for server-side and CLI flows).

    ```env title=".env"
    TUVL_OAUTH_UI_REDIRECT_URL=https://app.example.com/auth/callback
    ```

### Token refresh

```ts
const { access_token: newToken } = await auth.refresh(currentToken);
client.setToken(newToken);   // update the workflow client in-place
```

### Logout

```ts
await auth.logout(token);
// discard the token from storage after this call
```

### Full bootstrap → login → call example

```ts
import { TuvlAuth, TuvlClient } from "@tuvl/client";

const BASE_URL = "http://localhost:8000";
const auth = new TuvlAuth({ baseUrl: BASE_URL });

// Step 1 — on a fresh install: bootstrap the first admin
// (curl -X POST .../auth/bootstrap  or via the tuvl UI)

// Step 2 — login
const { access_token } = await auth.loginWithPassword("admin@example.com", "secret");

// Step 3 — use the token for workflow calls
const client = new TuvlClient({ baseUrl: BASE_URL, token: access_token });
const result = await client.execute("hello");

// Step 4 — refresh before expiry (default TTL: 24 h)
const { access_token: fresh } = await auth.refresh(access_token);
client.setToken(fresh);
```

---

## Admin: Users

All user management endpoints require the `iam:admin` scope.

### Create User

```http
POST /auth/admin/users
Authorization: Bearer <admin_token>
Content-Type: application/json
```

```json
{
  "email": "jane@example.com",
  "password": "secure-password",
  "is_active": true
}
```

- `password` is optional — omit it for federated-only accounts.
- Returns `201 Created` with the user object.

### List Users

```http
GET /auth/admin/users
Authorization: Bearer <admin_token>
```

Returns an array of user objects including their assigned roles.

### Get Single User

```http
GET /auth/admin/users/{user_id}
Authorization: Bearer <admin_token>
```

### Update User

```http
PATCH /auth/admin/users/{user_id}
Authorization: Bearer <admin_token>
Content-Type: application/json
```

```json
{
  "password": "new-password",
  "is_active": false
}
```

Both fields are optional. Omit a field to leave it unchanged.

### Delete User

```http
DELETE /auth/admin/users/{user_id}
Authorization: Bearer <admin_token>
```

Returns `204 No Content`. Also removes all role assignments for the user.

---

## Admin: Roles

### Create Role

```http
POST /auth/admin/roles
Authorization: Bearer <admin_token>
Content-Type: application/json
```

```json
{
  "name": "hr_manager",
  "description": "Can manage job requisitions and review candidates",
  "scopes": ["requisition:write", "candidate:read"]
}
```

### List Roles

```http
GET /auth/admin/roles
Authorization: Bearer <admin_token>
```

### Update Role Scopes

Replace the complete scope list for a role:

```http
PATCH /auth/admin/roles/{role_id}/scopes
Authorization: Bearer <admin_token>
Content-Type: application/json
```

```json
{
  "scopes": ["requisition:write", "candidate:read", "interview:read"]
}
```

This operation is atomic — all existing scopes are deleted and the new list is inserted in one transaction.

### Delete Role

```http
DELETE /auth/admin/roles/{role_id}
Authorization: Bearer <admin_token>
```

Returns `204 No Content`.

---

## Admin: Role Assignment

### Assign Role to User

```http
POST /auth/admin/users/{user_id}/roles/{role_id}
Authorization: Bearer <admin_token>
```

Returns `200 OK`. The user's next token (on refresh or re-login) will include the new role's scopes.

### Revoke Role from User

```http
DELETE /auth/admin/users/{user_id}/roles/{role_id}
Authorization: Bearer <admin_token>
```

Returns `204 No Content`.

---

## Protecting Your Own Endpoints

### Require Authentication

Use `verify_token` + `get_current_user` as FastAPI dependencies:

```python
from fastapi import APIRouter, Depends
from tuvl.core.auth.biscuit_auth import get_current_user
from tuvl.core.auth.schemas import TokenUser

router = APIRouter()

@router.get("/my-endpoint")
async def my_endpoint(user: TokenUser = Depends(get_current_user)):
    return {"user_id": user.user_id, "scopes": user.scopes}
```

### Require a Specific Scope

```python
from tuvl.core.auth.biscuit_auth import require_scope

@router.post("/requisitions")
async def create_requisition(
    user: TokenUser = Depends(require_scope("requisition:write")),
):
    ...
```

`require_scope` raises `403 Forbidden` if the token does not carry the required scope.

### Require Group Membership

```python
from tuvl.core.auth.biscuit_auth import require_groups

@router.get("/admin-panel")
async def admin_panel(
    user: TokenUser = Depends(require_groups(["hr_manager", "superadmin"])),
):
    ...
```

`require_groups` raises `403 Forbidden` unless the token carries at least one of the listed groups.

---

## Database Tables

The IAM system creates four tables on startup:

| Table | Purpose |
|-------|---------|
| `iam_users` | User credentials (email, bcrypt hash, federation fields) |
| `iam_roles` | Named roles with optional description |
| `iam_user_roles` | Many-to-many: user ↔ role assignments |
| `iam_role_scopes` | One row per scope per role |

Tables are created automatically via SQLModel's `create_all` during startup — no migration tool required for initial setup.

---

## Dev Mode

In `tuvl dev`, the dev API key (auto-generated and shown on startup) is accepted on all `/auth/*`
endpoints as a synthetic superuser with the `iam:admin` scope. This removes the need to create a
user or manage tokens during local development.

```bash
# Both of these work in dev mode:
curl -H "Authorization: Bearer <dev_api_key>" http://localhost:8000/dev/files
curl -H "Authorization: Bearer <dev_api_key>" http://localhost:8000/auth/admin/users
```
