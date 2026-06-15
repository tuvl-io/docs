# Configuration Overview

tuvl uses YAML files for all configuration. This keeps your logic declarative and version-controllable.

## Configuration Types

| Kind | Directory | Purpose |
|------|-----------|---------|
| `ModelDefinition` | `models/` | Data model schemas |
| `Workflow` | `workflows/` | Business logic flows |
| `DataSource` | `datasources/` | Database connections |
| `AgentModel` | `agents/` | LLM provider presets |

## Environment Variables

Sensitive values use environment variable substitution:

```yaml
connection:
  host: "${POSTGRES_HOST}"
  password: "${POSTGRES_PASSWORD}"
```

### Syntax

| Pattern | Behavior |
|---------|----------|
| `${VAR}` | Required — fails if not set |
| `${VAR:default}` | Optional — uses default if not set |
| `${VAR:-default}` | Same as above (alternate syntax) |

### Example

```yaml
spec:
  connection:
    host: "${POSTGRES_HOST}"           # Required
    port: ${POSTGRES_PORT:5432}        # Default: 5432
    database: "${POSTGRES_DB:-tuvl}"   # Default: tuvl
```

## File Organization

```
project/
├── .env                 # Secret values (git-ignored)
├── .env.example         # Template (safe to commit)
├── models/
│   ├── user.yaml
│   └── order.yaml
├── workflows/
│   ├── onboarding.yaml
│   └── checkout.yaml
├── datasources/
│   └── postgres.yaml
└── agents/
    └── default.yaml
```

## Common Patterns

### YAML Anchors

Reduce duplication with anchors:

```yaml
# Define anchor
defaults: &defaults
  timeout: 30
  retry:
    attempts: 3
    backoff: 2

steps:
  - id: "step1"
    <<: *defaults       # Merge anchor
    runner: "process_a"
    
  - id: "step2"
    <<: *defaults       # Reuse
    runner: "process_b"
```

### Multi-Document Files

tuvl reads each YAML document separately using `yaml.safe_load_all`. This lets you
pack multiple definitions into a single file — useful for colocating related versions:

```yaml
# models/all.yaml
kind: "ModelDefinition"
metadata:
  name: "User"
  schema_version: "v1"
spec:
  tablename: "users"
  # ...

---

kind: "ModelDefinition"
metadata:
  name: "User"
  schema_version: "v2"  # new version in same file
enabled: false           # staged — activate via admin API
spec:
  tablename: "users"
  # ...
```

The same pattern works for `Workflow` documents. Every version — enabled or disabled —
is stored in the corresponding `*_VERSION_REGISTRY` so the admin API can list, toggle,
and fork it.

### `schema_version`

`metadata.schema_version` tags a definition with a version string. It defaults to
`"v1"` when omitted. Multiple definitions sharing the same `metadata.name` but
different `schema_version` values coexist in the registry independently.

### `enabled`

Setting `enabled: false` excludes a definition from active use (no route mounted, no
CRUD endpoints) but keeps it visible and manageable through the admin API. Omitting the
field is equivalent to `enabled: true`.
  name: "Order"
spec:
  tablename: "orders"
  # ...
```

## Validation

tuvl validates configurations at startup. Invalid files are logged and skipped:

```
INFO:     📋  Model loaded: 'User'
WARNING:  ⚠️  models/broken.yaml: missing required field 'spec.tablename' — skipped
INFO:     📋  Model loaded: 'Order'
```

## Hot Reloading (Development)

In development mode, configuration changes are detected:

```bash
tuvl dev --reload
```

!!! warning "Production"
    Disable hot reloading in production for stability.

## Next Steps

- [Datasources](datasources.md) — Database configuration
- [Agents](agents.md) — LLM provider setup
