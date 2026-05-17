# Redis Configuration

Redis is an optional but **strongly recommended** infrastructure dependency for tuvl.
It is used for:

| Feature | Without Redis | With Redis |
|---------|--------------|------------|
| OAuth CSRF state tokens | In-process dict (single worker only) | Shared across all workers |
| Token revocation blacklist | In-process dict (single worker only) | Shared across all workers |

---

## When Is Redis Required?

Redis is **required** for any multi-worker or multi-process deployment. If you run
more than one tuvl worker (e.g. `tuvl run --workers 4`), there is no shared memory
between processes. Without Redis:

- An OAuth callback routed to a different worker than the one that generated the state will **always fail** the CSRF check.
- A token revoked via `POST /auth/logout` on one worker **will still be accepted** by all other workers.

In single-worker `tuvl dev` mode Redis is optional — the in-process fallback is sufficient.

---

## Configuration

Create a YAML file in your project's `datasources/` directory:

```yaml title="datasources/redis-primary.yaml"
kind: DataSource
version: v1
metadata:
  name: redis-primary
spec:
  type: redis
  connection:
    host: ${REDIS_HOST:localhost}
    port: ${REDIS_PORT:6379}
    db: 0
    password: ${REDIS_PASSWORD:}    # empty string → no AUTH command sent
```

tuvl picks up the first `type: redis` datasource (sorted alphabetically by name) and
attempts to connect at startup.

### Connection Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `host` | string | `localhost` | Redis server hostname or IP |
| `port` | integer | `6379` | Redis server port |
| `db` | integer | `0` | Database index (0–15) |
| `password` | string | *(none)* | AUTH password; omit or leave blank for no auth |

### Environment Variables

```env title=".env"
REDIS_HOST=redis.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password   # optional
```

### Environment Variable Syntax

The `${VAR:default}` syntax used in the YAML is resolved before connecting:

| Pattern | Behaviour |
|---------|-----------|
| `${REDIS_HOST:localhost}` | Uses `REDIS_HOST` env var; falls back to `localhost` |
| `${REDIS_PASSWORD:}` | Uses `REDIS_PASSWORD` env var; falls back to empty string (no auth) |
| `${REDIS_HOST}` | Requires `REDIS_HOST` to be set — fails startup with a clear error if missing |

---

## Startup Behaviour

When tuvl starts, it logs one of the following:

```
🟥  Redis connected: localhost:6379 db=0 (datasource: 'redis-primary')
```

or, if no datasource is configured or connection fails:

```
ℹ️  No Redis datasource configured — OAuth state and token blacklist will use
    in-process memory (not suitable for multi-worker deployments).
```

or, if the datasource is configured but the server is unreachable:

```
⚠️  Redis datasource 'redis-primary' (localhost:6379) is unreachable: ...
    — falling back to in-process memory.
```

tuvl **never fails to start** due to Redis being unavailable. The fallback is automatic.
Redis availability is checked at the point of use via `is_redis_available()`.

---

## Using Redis for Other Purposes

The Redis client is accessible in application code for custom caching or messaging:

```python
from tuvl.core.infra.redis import get_redis_client, is_redis_available

async def my_function():
    if is_redis_available():
        redis = get_redis_client()
        await redis.set("my:key", "value", ex=300)
    else:
        # fallback path
        ...
```

---

## Docker Setup

```yaml title="docker-compose.yml"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass "${REDIS_PASSWORD}"
    volumes:
      - redis_data:/data

  tuvl:
    # ...
    environment:
      REDIS_HOST: redis
      REDIS_PASSWORD: "${REDIS_PASSWORD}"
    depends_on:
      - redis

volumes:
  redis_data:
```

---

## Managed Redis Services

| Provider | Notes |
|----------|-------|
| **AWS ElastiCache** | Set `host` to the primary endpoint; use `password` for auth token |
| **Redis Cloud** | Standard connection; enable TLS if required (not yet built-in; use a tunnel) |
| **Upstash** | REST API not supported; use the standard TCP endpoint |
| **Render / Railway** | Use the internal `REDIS_URL`; parse host/port/password from it manually |
| **Azure Cache for Redis** | Use non-TLS port `6379` for simplicity or configure a TLS proxy |

---

## UI Configuration

Redis can be configured directly from the tuvl UI:

1. Navigate to **Settings → Infrastructure → Redis**
2. Fill in the host, port, db index, and optional password
3. Click **Save** — the YAML file will be written to `datasources/redis-primary.yaml`

The status badge shows **Configured** when the file exists. The actual Redis connectivity
is only visible in the server logs at startup.
