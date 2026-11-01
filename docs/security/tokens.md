# Access Tokens

tuvl authenticates callers with **access tokens**: JSON Web Tokens (JWTs) signed with the
server's Ed25519 key (`alg: EdDSA`). A token carries the caller's identity, IAM roles and
scopes; it can't be forged or altered without the key, and any service holding tuvl's public
key can verify it.

!!! note "Changed in 2.0"
    tuvl 1.x used Biscuit tokens. 2.0 issues JWTs with the same claims, signed with the same
    key — see [Upgrading from 1.x](#upgrading-from-1x).

---

## Token Structure

A token is three base64url parts — header, claims, signature — sent in every API request as
an HTTP Bearer token:

```http
Authorization: Bearer eyJhbGciOiJFZERTQSIsImtpZCI6Ii4uLiJ9.eyJpc3MiOiJ0dXZsIiwuLi59.c2ln…
```

```json title="header"
{ "alg": "EdDSA", "typ": "JWT", "kid": "tX6By-eOwUtPXkJI" }
```

```json title="claims"
{
  "iss": "tuvl",
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "groups": ["hr_manager"],
  "scopes": ["requisition:write", "candidate:read"],
  "tenant": "acme",
  "iat": 1747094400.123,
  "exp": 1747180800,
  "jti": "9f2c…"
}
```

| Claim | Meaning |
|---|---|
| `iss` | Always `tuvl` |
| `sub` | The user id |
| `groups` | The user's IAM role names |
| `scopes` | The scopes those roles grant |
| `tenant` | The tenant id — multi-tenant deployments only |
| `iat` | Issued at (seconds, millisecond precision) |
| `exp` | Expiry (seconds) — omitted only when `TUVL_TOKEN_TTL_SECONDS=0` |
| `jti` | A unique token id |

!!! warning "Claims are readable, not secret"
    A JWT is signed, not encrypted: anyone holding a token can read its claims (that's how
    clients show who is signed in). Keep secrets and personal data out of tokens.

---

## Token Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Minted: POST /auth/token\nor OAuth callback
    Minted --> Active: Valid, not expired, not revoked
    Active --> Expired: exp passed
    Active --> Revoked: POST /auth/logout\nor POST /auth/refresh (old token)
    Active --> Ended: user deactivated, deleted,\nor a role/scope taken away
    Active --> Refreshed: POST /auth/refresh (new token issued)
    Expired --> [*]
    Revoked --> [*]
    Ended --> [*]
```

---

## Token TTL

The default lifetime is **86400 seconds (24 hours)**. Change it per deployment:

```env title=".env"
TUVL_TOKEN_TTL_SECONDS=3600   # 1 hour
```

Setting `TUVL_TOKEN_TTL_SECONDS=0` omits `exp` entirely. This is **not recommended for
production** — such tokens end only by revocation or a session end.

An expired token is refused by signature verification itself:

```json
HTTP/1.1 401 Unauthorized
{"detail": "Token has expired or failed authorization checks."}
```

---

## Token Refresh

A client may request a new token before expiry:

```bash
curl -X POST http://localhost:8885/auth/refresh \
  -H "Authorization: Bearer <current_token>"
```

The server:
1. Verifies the current token (valid, not expired, not revoked)
2. Looks up the user in the database (must still be active)
3. Mints a new token with a fresh TTL and the user's current roles
4. **Revokes the old token** by adding it to the blacklist

```json
{ "access_token": "<new token>", "token_type": "bearer" }
```

Clients can tell when to refresh by reading `exp` — `@tuvl/client` has `isTokenExpired(token)`.

---

## Revocation and Session Ends

**Revocation.** Logout and refresh put the token on a **blacklist** that every request
checks, so it's refused even before `exp`. The blacklist stores the **SHA-256 hash** of each
token — the raw token is never persisted.

**Session ends.** When a user's access shrinks — deactivated, password changed, deleted, a
role removed, or a role they hold deleted or stripped of a scope — tuvl records *sessions
ended now* for that user, and every token issued before then is refused with
`401 Session ended — sign in again.` Granting access ends nothing; it arrives at the next
sign-in.

### Storage backends

| Backend | When used | Scope |
|---------|-----------|-------|
| **Redis** | A `type: redis` datasource is configured | Shared across all workers |
| **In-process dict** | No Redis configured (fallback) | Single worker only |

!!! warning "Multi-worker deployments"
    Without Redis, a token revoked (or a session ended) by one worker is still accepted by
    the others, because each process has its own store. Configure a Redis datasource before
    scaling to multiple workers. See [Redis Configuration](../configuration/redis.md).

Entries live as long as a token can (the token TTL), then expire on their own.

---

## Signing Keys

Tokens are signed with an **Ed25519** private key managed by `TuvlKeyManager`.

### Persistent mode (required for production)

```env title=".env"
TUVL_SIGNING_KEY=<64-hex-char Ed25519 private key>
```

Generate a key with the CLI:

```bash
tuvl generate key            # prints the key and the .env line to paste
tuvl generate key --write    # writes TUVL_SIGNING_KEY into the project .env (mode 0600)
```

!!! warning "Required for `tuvl serve app`"
    Production mode fails closed if no signing key is set — it will **not** fall back to an
    ephemeral key the way `tuvl dev` does. Keep the key stable: rotating it invalidates every
    existing token.

??? note "Generate without the CLI"
    ```bash
    python3 -c "from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey as K; from cryptography.hazmat.primitives import serialization as s; print(K.generate().private_bytes(s.Encoding.Raw, s.PrivateFormat.Raw, s.NoEncryption()).hex())"
    ```

### Ephemeral mode (development only)

Without a signing key:

- **Production mode** (the default): the server **refuses to start** with a `RuntimeError`.
- **Dev mode** (`tuvl dev`): a fresh key is generated in memory; tokens are invalid after a
  restart, and a warning says so.

### Verifying tokens elsewhere

tuvl publishes its public key as a JSON Web Key Set:

```bash
curl http://localhost:8885/auth/jwks.json
# {"keys":[{"kty":"OKP","crv":"Ed25519","x":"…","kid":"tX6By-eOwUtPXkJI","alg":"EdDSA","use":"sig"}]}
```

A gateway or another service can verify tuvl tokens offline with it — accept `EdDSA` only,
and check `iss: tuvl` and `exp`. Offline verification can't see revocations or session ends;
call `GET /auth/me` when those matter.

---

## Security Guarantees

| Property | How it is achieved |
|----------|--------------------|
| **Integrity** | Ed25519 signature — any change to header or claims invalidates the token |
| **No algorithm confusion** | Only `EdDSA` is accepted: `alg: none` and HMAC tokens keyed with the public key are refused |
| **Required claims** | `iss`, `sub` and `iat` must be present; `iss` must be `tuvl`; claims are shape-checked |
| **Expiry** | `exp` is signed and checked on every request |
| **Revocation** | SHA-256 blacklist in Redis or in-process memory |
| **Immediate access removal** | Session ends refuse tokens issued before a user's access shrank |
| **Name injection prevention** | Scope/group values validated against `^[\w:.\-/]+$` before minting |

---

## Token Inspection

The claims are readable with any JWT tool (the signature isn't checked by these):

```bash
python3 -c "import jwt,sys; print(jwt.decode(sys.argv[1], options={'verify_signature': False}))" "$TOKEN"
```

From TypeScript, `readToken(token)` in `@tuvl/client` returns the claims.

---

## Upgrading from 1.x

- **Set `TUVL_SIGNING_KEY`.** 2.0 no longer reads the 1.x `TUVL_BISCUIT_PRIVATE_KEY`. Its value is the
  same 32-byte Ed25519 key, so you can move it to `TUVL_SIGNING_KEY` unchanged, or run
  `tuvl generate key --write --force` for a new one. Without a key a production server will not start.
- **Everyone signs in once.** Biscuit tokens issued by 1.x are not accepted by 2.0.
- **Python 3.14 is supported.** 1.x was held to Python 3.13 by `biscuit-python`'s missing
  3.14 builds; 2.0 runs on 3.13 and 3.14.
