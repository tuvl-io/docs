# Datasource Configuration

Datasources define database connections for your tuvl application.

## PostgreSQL Configuration

```yaml title="datasources/postgres.yaml"
kind: "DataSource"
version: "v1"
metadata:
  name: "main_postgres"
  primary: true
spec:
  type: "postgresql"
  driver: "asyncpg"
  connection:
    host: "${POSTGRES_HOST}"
    port: ${POSTGRES_PORT:5432}
    database: "${POSTGRES_DB}"
    username: "${POSTGRES_USER}"
    password: "${POSTGRES_PASSWORD}"
  pooling:
    min_size: 5
    max_size: 20
```

## Metadata Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for this datasource |
| `primary` | boolean | No | Mark this as the primary datasource. System tables (IAM, HITL, vector store) and the bootstrap ledger are created here. Only one datasource should be marked primary; if none is marked, the first Postgres datasource loaded is used automatically. |

## Connection Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `host` | string | Yes | Database server hostname |
| `port` | integer | No | Port number (default: 5432) |
| `database` | string | Yes | Database name |
| `username` | string | Yes | Connection username |
| `password` | string | Yes | Connection password |

## Pool Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `min_size` | integer | 5 | Minimum connections to maintain |
| `max_size` | integer | 20 | Maximum connections allowed |

### Tuning Guidelines

- **Development**: `min_size: 2`, `max_size: 10`
- **Production**: `min_size: 5-10`, `max_size: 20-50`
- Keep `min_size` low to reduce idle resource usage
- Set `max_size` based on expected concurrent requests

## Environment Variables

Create a `.env` file:

```env title=".env"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tuvl
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secret_password
```

And a `.env.example` for documentation:

```env title=".env.example"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tuvl
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
```

## Multiple Databases

Define multiple datasources for different purposes:

```yaml title="datasources/primary.yaml"
kind: "DataSource"
version: "v1"
metadata:
  name: "primary"
spec:
  type: "postgresql"
  driver: "asyncpg"
  connection:
    host: "${PRIMARY_DB_HOST}"
    database: "${PRIMARY_DB_NAME}"
    username: "${PRIMARY_DB_USER}"
    password: "${PRIMARY_DB_PASSWORD}"
```

```yaml title="datasources/analytics.yaml"
kind: "DataSource"
version: "v1"
metadata:
  name: "analytics"
spec:
  type: "postgresql"
  driver: "asyncpg"
  connection:
    host: "${ANALYTICS_DB_HOST}"
    database: "${ANALYTICS_DB_NAME}"
    username: "${ANALYTICS_DB_USER}"
    password: "${ANALYTICS_DB_PASSWORD}"
```

## SSL/TLS Configuration

For secure connections:

```yaml
spec:
  type: "postgresql"
  driver: "asyncpg"
  connection:
    host: "${POSTGRES_HOST}"
    port: 5432
    database: "${POSTGRES_DB}"
    username: "${POSTGRES_USER}"
    password: "${POSTGRES_PASSWORD}"
  ssl:
    mode: "require"           # disable, allow, prefer, require, verify-ca, verify-full
    ca_cert: "/path/to/ca.crt"
```

## Docker Compose Example

```yaml title="docker-compose.yaml"
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tuvl
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: tuvl
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    depends_on:
      - postgres

volumes:
  postgres_data:
```

## Connection String Format

Internally, tuvl builds a connection string:

```
postgresql+asyncpg://user:password@host:port/database
```

## Troubleshooting

### Connection Refused

```
sqlalchemy.exc.OperationalError: connection refused
```

- Check PostgreSQL is running: `pg_isready -h localhost`
- Verify hostname and port
- Check firewall rules

### Authentication Failed

```
asyncpg.exceptions.InvalidPasswordError: password authentication failed
```

- Verify username and password
- Check `pg_hba.conf` authentication settings

### Database Does Not Exist

```
asyncpg.exceptions.InvalidCatalogNameError: database "tuvl" does not exist
```

Create the database:

```bash
createdb tuvl
# or
psql -c "CREATE DATABASE tuvl;"
```

### Pool Exhausted

```
asyncpg.exceptions.TooManyConnectionsError
```

- Increase `max_size` in pool config
- Check for connection leaks (unclosed sessions)
- Add connection timeout handling

## Best Practices

### 1. Never Commit Secrets

```gitignore title=".gitignore"
.env
*.pem
*.key
```

### 2. Use Environment Variables

```yaml
# Good
password: "${POSTGRES_PASSWORD}"

# Never do this
password: "hardcoded_password"
```

### 3. Set Reasonable Pool Limits

```yaml
pooling:
  min_size: 5          # Low enough for idle efficiency
  max_size: 20         # High enough for peak load
```

### 4. Use SSL in Production

```yaml
ssl:
  mode: "verify-full"
  ca_cert: "${SSL_CA_PATH}"
```

---

## Redis Configuration

Redis is a second supported datasource type used for distributed state — specifically
OAuth CSRF tokens and the token revocation blacklist.

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
    password: ${REDIS_PASSWORD:}    # leave blank for no authentication
```

### Redis Connection Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `host` | string | `localhost` | Redis server hostname |
| `port` | integer | `6379` | Redis server port |
| `db` | integer | `0` | Database index (0–15) |
| `password` | string | *(none)* | AUTH password; omit for unauthenticated connections |

!!! note "Selection logic"
    When multiple `type: redis` datasource files exist, tuvl picks the one that sorts
    first alphabetically by filename. Name your primary Redis file `redis-primary.yaml`
    or `00-redis.yaml` to ensure predictable selection.

!!! warning "Multi-worker requirement"
    Without a configured and reachable Redis datasource, OAuth state tokens and the token
    revocation blacklist fall back to in-process memory. This is only safe for single-worker
    development. For production multi-worker deployments Redis is **required**.

For full details on scaling considerations and Docker setup, see [Redis Configuration](redis.md).

---

## Next Steps

- [Redis](redis.md) — Configure Redis for distributed state
- [Agents](agents.md) — Configure LLM providers
- [Models](../concepts/models.md) — Define data models
