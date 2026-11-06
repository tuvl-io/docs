# Configuration Overview

tuvl uses YAML files for all configuration. This keeps your logic declarative and version-controllable.

## Configuration Types

| Kind | Directory | Purpose |
|------|-----------|---------|
| `ModelDefinition` | `models/` | Data model schemas |
| `Workflow` | `workflows/` | Business logic flows |
| `DataSource` | `datasources/` | Database connections |
| `AgentModel` | `llms/` | LLM and decision models |
| `Storage` | `storage/` | Named blob stores: S3, Azure Blob, GCS, local disk ([Blob Storage](../internals/storage.md)) |
| `Artifact` | `artifacts/` | Named, versioned assets — prompts, steering, skills, guardrails, hooks, MCP servers — referenced via `artifact://name[@version]` |
| `SystemConfig` | `.tuvl/system.yaml` | Project-level, boot-time API surface settings |

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
agents:
  - id: summarise
    # …
    budget: &llm_budget { timeout: 30s, max_tokens: 1500, retry: { attempts: 2, errors: [timeout, parse_error] } }
  - id: reply
    # …
    budget: *llm_budget
```

Define the anchor where it is first used: documents are strict, so an extra top-level key just to hold
an anchor is rejected.

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

## SystemConfig (`.tuvl/system.yaml`)

Boot-time settings that shape the mounted API surface, read once at startup. **Restart required**
for a change to take effect. Each setting can also be set in the environment, and the environment
wins over `.tuvl/system.yaml`.

```yaml
kind: SystemConfig
metadata:
  name: system
spec:
  api:
    expose_model_crud: false   # default: true
    expose: [auth]             # system route groups a production server mounts
    docs: workflows            # off | workflows | all
    dev_expose_all: true       # false: the dev server mounts only what production would
    cors_origins:              # default: none
      - https://app.example.com
      - http://localhost:5173
```

| Key | Environment | What it does |
|---|---|---|
| `expose_model_crud` | `TUVL_EXPOSE_MODEL_CRUD` | `false` unmounts every auto-generated `/models/*` CRUD router: the routes are absent entirely, not merely scope-denied, leaving only hand-authored `Workflow` triggers exposed. |
| `expose` | `TUVL_API_EXPOSE` | Which of `auth`, `admin`, `artifacts`, `system` a production server mounts (`runs` always is). |
| `docs` | `TUVL_API_DOCS` | What `/docs`, `/redoc` and `/openapi.json` show: `off`, `workflows` or `all`. |
| `dev_expose_all` | `TUVL_DEV_EXPOSE_ALL` | `false` makes the dev server mount what production would. |
| `cors_origins` | `TUVL_CORS_ORIGINS` | Browser origins (`scheme://host[:port]`, no trailing slash) allowed to call the API from another origin. None by default, in dev too. |

The first four are explained in [API](../internals/api.md#which-routes-a-server-exposes); `cors_origins` has its
own section, [Calling from a browser](../internals/api.md#calling-from-a-browser). In dev mode,
`expose_model_crud` is also editable from the Insight [Settings page](../insight/settings.md#api-access)'s
API Access section.

See [Authorization Surfaces](../security/iam.md#authorization-surfaces) for the CRUD
and workflow-trigger auth model this knob sits alongside.

## Validation

tuvl lint projects configurations at startup. Invalid files are logged and skipped:

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
