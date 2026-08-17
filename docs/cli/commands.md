# CLI Commands

Detailed reference for all tuvl CLI commands.

## `tuvl init`

Create a new tuvl project with interactive setup.

### Usage

```bash
tuvl init [NAME] [OPTIONS]
```

### Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `NAME` | `.` | Project directory name |

### Options

| Option | Description |
|--------|-------------|
| `--project-dir`, `-d` | Alias for NAME argument |
| `--sample` | Write recruitment sample files covering every step kind, plus telemetry config and test templates |
| `--multi-tenant` | Bootstrap a multi-tenant project — writes `.tuvl/system.yaml` with `mode: multi_tenant` and includes a sample tenant config |

### Examples

The command prompts for:

1. **PostgreSQL configuration** (optional)
   - Host, port, database, user, password

2. **LLM provider** (optional)
   - Provider: ollama, openai, anthropic, other
   - API key or base URL
   - Default model

### Interactive Prompts

The command prompts for:

1. **PostgreSQL configuration** (optional)
   - Host, port, database, user, password

2. **LLM provider** (optional)
   - Provider: ollama, openai, anthropic, other
   - API key or base URL
   - Default model

### Output Structure

```
my-project/
├── models/           # ModelDefinition YAMLs
├── workflows/        # Workflow YAMLs
├── datasources/      # DataSource YAMLs
│   └── postgres.yaml # If postgres configured
├── llms/             # AgentModel configs
│   └── default.yaml  # If LLM configured
├── nodes/            # Python node implementations
├── .tuvl/
│   ├── telemetry.yaml  # OTel config (written with --sample)
│   └── system.yaml     # Multi-tenancy config (written with --multi-tenant)
├── tests/
│   └── workflows/    # Workflow test cases (written with --sample)
├── .env              # Secrets (git-ignored)
├── .env.example      # Safe template
└── .gitignore
```

### Examples

```bash
# Create in current directory
tuvl init

# Create new directory
tuvl init my-app

# Specify path
tuvl init --project-dir /path/to/project

# Include sample files (workflow, nodes, tests, telemetry config)
tuvl init my-app --sample

# Bootstrap a multi-tenant project
tuvl init my-app --multi-tenant
```

---

## `tuvl dev`

Start the development server with hot-reload. A per-session API key is generated and
printed to the terminal on each start. The tuvl UI uses this key to authenticate all
requests without requiring a user login.

### Usage

```bash
tuvl dev [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project directory |
| `--host` | `127.0.0.1` | Bind address |
| `--port` | `8885` | Port number |
| `--show-key` | `false` | Print the dev session API key to the console |
| `--auto-login` | `false` | Automatically bypass the Tuvl Insight security screen |

### Examples

```bash
# Start with defaults
tuvl dev

# Custom port
tuvl dev --port 3000

# Specific project directory
tuvl dev --project-dir ./services/api
```

### Dev Session Key

On each startup tuvl generates a secure session API key. By default, this key is written to `.tuvl/.dev-session` and the UI will prompt you to enter it on the login screen.

```
🚀  tuvl dev server starting...
🔑  Dev API key saved to .tuvl/.dev-session
🌐  UI: http://localhost:8885/ui
```

If you prefer to bypass the login screen automatically during development, use the `--auto-login` flag:

```bash
tuvl dev --auto-login
```

When `--auto-login` is enabled, the UI reads the key from a `<meta name="tuvl-dev-key">` tag injected into the `index.html` placeholder and authenticates automatically.

The dev key also grants `iam:admin` scope on all `/auth/admin/*` endpoints, so you
can manage users and roles without bootstrapping the IAM system.

!!! warning "Dev mode only"
    The dev server enables hot-reload, the `/dev/*` file management API, and the
    Spectrum debugger. Never expose a dev server to the public internet.

---

## `tuvl run`

Start the production server.

### Usage

```bash
tuvl run [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project directory |
| `--host` | `0.0.0.0` | Bind address |
| `--port` | `8885` | Port number |
| `--workers` | `1` | Number of workers |

### Examples

```bash
# Production server
tuvl run --workers 4

# With custom settings
tuvl run --host 127.0.0.1 --port 80 --workers 8
```

### Production Recommendations

```bash
# Behind a reverse proxy
tuvl run --host 127.0.0.1 --port 8885 --workers 4

# With environment
POSTGRES_HOST=prod-db tuvl run --workers 4
```

!!! warning "Signing key required"
    `tuvl run` fails to start unless a persistent `TUVL_BISCUIT_PRIVATE_KEY` is set — it
    will **not** fall back to an ephemeral key the way `tuvl dev` does. Generate one with
    [`tuvl keys generate`](#tuvl-keys) and add it to your `.env`. See
    [Tokens → Signing Keys](../security/tokens.md#signing-keys).

---

## `tuvl keys`

Manage the **Ed25519** key used to sign Biscuit authentication tokens.

### `tuvl keys generate`

Generate a persistent private key for `TUVL_BISCUIT_PRIVATE_KEY`. Production mode
(`tuvl run`) requires this key; `tuvl dev` generates an ephemeral one automatically.

#### Usage

```bash
tuvl keys generate [OPTIONS]
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--write`, `-w` | off | Write the key into the project `.env` instead of only printing it |
| `--force`, `-f` | off | Overwrite an existing `TUVL_BISCUIT_PRIVATE_KEY` (with `--write`) |
| `--project-dir`, `-d` | `.` | Project directory whose `.env` to update (with `--write`) |

#### Examples

```bash
# Print a fresh key + the .env line to paste
tuvl keys generate

# Write it straight into the project .env (owner-only perms)
tuvl keys generate --write

# Rotate an existing key
tuvl keys generate --write --force
```

!!! danger
    Keep the key secret and stable. Changing it invalidates every previously issued token.

---

## `tuvl db`

Database maintenance subcommands for multi-tenant Row-Level Security (RLS).
Both subcommands load the project first — models, datasources, and the
`tenant_id` column injected under `multi_tenant` mode — so the tenant-scoped
tables they operate on are the project's actual tables, not just tuvl's
internal system tables.

### `tuvl db generate-rls`

Print idempotent RLS-enable + tenant-isolation policy SQL for every
tenant-scoped table. Review the output and apply it through your normal
migration tool (Alembic, raw `psql`, etc.) — re-running the generator and
re-applying the SQL is always safe.

```bash
# Print to stdout
tuvl db generate-rls

# Write to a file
tuvl db generate-rls --out deploy/rls.sql

# Against a specific project
tuvl db generate-rls --project-dir ./my-project
```

### `tuvl db check-rls`

Connect to the configured primary datasource and verify every tenant-scoped
table has the `tuvl_tenant_isolation` policy installed. Exits `0` when every
expected policy is present, and `1` (listing the missing tables) otherwise —
designed to run in CI before promoting a deployment to a multi-tenant
environment. In `single_tenant` mode it reports that there's nothing to
check.

```bash
tuvl db check-rls
```

---

## `tuvl test`

Run LLM-as-a-Judge workflow tests. Discovers YAML test files, executes each workflow
using stub-injected data (no real LLM/DB/HTTP calls), collects per-step traces, and
optionally sends each trace to a judge model for natural-language evaluation.

See the full guide: [Testing Workflows](../tools/testing.md)

### Usage

```bash
tuvl test [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project root |
| `--tests-dir` | `tests/workflows/` | Directory containing `*.yaml` test files |

### Examples

```bash
# Run all tests in tests/workflows/ (deterministic only)
tuvl test

# With LLM judge evaluation
TUVL_TEST_JUDGE=gpt-4o tuvl test

# Custom test directory
tuvl test --tests-dir path/to/tests
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All evaluations passed (or no judge configured) |
| `1` | One or more evaluations failed |

---

## `tuvl validate`

Validate configuration files without starting the server.

Discovery is recursive and dispatched purely by each file's `kind:` field —
the same way the runtime loads a project. Any `*.yaml` or `*.yml` file
anywhere under the project directory is picked up regardless of which
folder it lives in (skipping `.tuvl/`, `.git/`, `deploy/`, virtualenvs, and
other dotdirs). This covers every resource kind, including
`EmbeddingRegistry`, `EmbeddingConfig`, `CollectionRegistry`,
`CollectionConfig`, `RedisConfig`, and `FederationProvider` alongside models,
workflows, and datasources. A file whose `kind:` isn't one tuvl recognizes is
a validation **error** (the runtime would otherwise silently skip it).

### Usage

```bash
tuvl validate [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project directory |
| `--verbose`, `-v` | `false` | Show detailed output |

### Examples

```bash
# Validate current project
tuvl validate

# Validate specific project
tuvl validate --project-dir ./my-project

# Verbose output
tuvl validate -v
```

### Output

Success:

```
✅  Models: 3 valid
✅  Workflows: 2 valid
✅  Datasources: 1 valid
✅  All configurations valid
```

With errors:

```
❌  models/broken.yaml:
    - Missing required field: spec.tablename
    - Invalid field type: "strin" at spec.fields[0].type
    
✅  workflows/onboarding.yaml: valid

⚠️  Validation failed: 1 error(s)
```

---

## `tuvl ship`

Package a project for production. `ship` validates the project, generates a
production `Dockerfile` + `.dockerignore` and a Helm chart, then builds the
container image.

Run from the project root (it reads the project's `pyproject.toml` for the image
name and version).

### Usage

```bash
tuvl ship [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project directory |
| `--tag`, `-t` | `<name>:<version>` | Image reference to build |
| `--no-build` | `false` | Write the Dockerfile and Helm chart but skip the build |
| `--push` | `false` | Push the image after a successful build |
| `--force` | `false` | Overwrite existing generated files (`deploy/`, `.dockerignore`) |
| `--strict` | `false` | Treat validation warnings as errors |

### What it does

1. **Validate** — runs the full `tuvl validate` pass. Any error aborts the ship
   before anything is written; `--strict` also aborts on warnings.
2. **Generate artifacts** — writes `deploy/Dockerfile`, a root `.dockerignore`,
   and a Helm chart under `deploy/chart/<name>/` (`Chart.yaml`, `values.yaml`,
   and templates for the Deployment, Service, and helpers). Existing files are
   left untouched unless you pass `--force`, so you can hand-edit them and
   re-run `ship` safely. If a kept `Chart.yaml`'s `appVersion` no longer
   matches the version being built, `ship` warns that the deployed image tag
   won't match — re-run with `--force` or bump `appVersion` by hand.
3. **Build the image** — runs `docker build` (skip with `--no-build`, publish
   with `--push`).

The generated image runs `tuvl run` as a non-root user with
`TUVL_ENV=production` — no dev routes, no Insight UI, JSON logs, telemetry on —
and a `/health` HEALTHCHECK.

### Examples

```bash
# Validate, containerize, and emit a Helm chart
tuvl ship

# Build and push a tagged image to a registry
tuvl ship --tag ghcr.io/acme/my-app:1.0.0 --push

# Generate deploy artifacts only (no docker build)
tuvl ship --no-build
```

### Deploying the chart

```bash
# Secrets the engine needs at runtime (Biscuit key, DB password, LLM keys)
kubectl create secret generic my-app-env --from-env-file=.env

helm install my-app deploy/chart/my-app \
  --set image.repository=ghcr.io/acme/my-app
```

!!! note
    `tuvl run` (and therefore the container) requires a persistent
    `TUVL_BISCUIT_PRIVATE_KEY` — generate one with `tuvl keys generate` and
    include it in the referenced Secret.

---

## `tuvl stream-watch`

Trigger a workflow and stream step events to the terminal over SSE. Useful for debugging long-running workflows without writing any code.

### Usage

```bash
tuvl stream-watch WORKFLOW [OPTIONS]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `WORKFLOW` | Workflow name (as registered in the server) |

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--payload` | `-p` | `{}` | JSON string sent as the workflow input payload |
| `--token` | `-t` | — | Biscuit Bearer token. Falls back to `TUVL_BISCUIT_TOKEN` env var |
| `--url` | `-u` | `http://localhost:8885` | Base URL of the tuvl server |
| `--timeout` | — | none | Read timeout in seconds for the SSE stream body. By default there is no timeout, so a quiet workflow (slow agent iterations, a HITL wait) can go arbitrarily long between events without the connection being torn down. Only affects the stream body — the initial manifest fetch always uses its own short timeout |

### Examples

```bash
# Stream hello workflow with no payload
tuvl stream-watch hello

# Stream with a JSON payload
tuvl stream-watch screen-candidate -p '{"candidate_id": 42}'

# Stream against a remote server with a token
tuvl stream-watch onboard-employee \
  --url https://api.mycompany.com \
  --token "$TUVL_BISCUIT_TOKEN" \
  -p '{"employee_id": "EMP-001"}'
```

### Output

Each step prints when it completes:

```
[step] extract_profile  kind=functional  signal=default  (34ms)
[step] lookup_ats       kind=api_call    signal=default  (812ms)
[step] draft_response   kind=agent       signal=approved (2341ms)
[done] output: {"message": "Onboarding email sent"}
```

A `[done]` line confirms the workflow finished and shows the final output. An `[error]` line appears on failure.

---

## Environment Variables

The CLI respects these environment variables (typically set in `<project>/.env`):

| Variable | Description |
|----------|-------------|
| `TUVL_PROJECT_DIR` | Override project directory |
| `TUVL_DEV_MODE` | Set to `true` in dev; `false` in production |
| `TUVL_BISCUIT_PRIVATE_KEY` | Hex-encoded Ed25519 key for signing tokens (see [Tokens](../security/tokens.md)) |
| `TUVL_TOKEN_TTL_SECONDS` | Token lifetime in seconds (default: `86400`) |
| `TUVL_OAUTH_BASE_URL` | Public base URL for OAuth2 redirect URIs |
| `TUVL_OAUTH_GOOGLE_CLIENT_ID` / `_SECRET` | Google OAuth2 credentials |
| `TUVL_OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | GitHub OAuth2 credentials |
| `TUVL_OAUTH_MICROSOFT_CLIENT_ID` / `_SECRET` / `_TENANT_ID` | Microsoft Entra ID credentials |
| `TUVL_TEST_JUDGE` | litellm model string for the LLM-as-a-Judge evaluator (e.g. `gpt-4o`). If not set, evaluation assertions are skipped and only deterministic execution is validated. |
| `TUVL_TELEMETRY_ENABLED` | Set to `false` to disable OTel span export in production mode |
| `TUVL_OTLP_ENDPOINT` | gRPC OTLP collector endpoint (default: `http://localhost:4317`) |
| `TUVL_SERVICE_NAME` | `service.name` attribute on every exported span (default: `tuvl`) |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | PostgreSQL connection |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Redis connection (optional — see [Redis](../configuration/redis.md)) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `LITELLM_*` | LiteLLM pass-through configuration |

### Example `.env`

```env
# Server
TUVL_HOST=0.0.0.0
TUVL_PORT=8885

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tuvl
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secret

# LLM
OPENAI_API_KEY=sk-...
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Configuration error |
| `3` | Connection error |

---

## Debugging

### Verbose Logging

```bash
# Set log level
LOG_LEVEL=DEBUG tuvl dev
```

### Common Issues

**Port in use:**

```bash
# Find process using port
lsof -i :8885

# Use different port
tuvl dev --port 8001
```

**Project not found:**

```bash
# Specify correct path
tuvl dev --project-dir /correct/path

# Or set environment variable
export TUVL_PROJECT_DIR=/my/project
tuvl dev
```

**Database connection failed:**

```bash
# Check PostgreSQL is running
pg_isready -h localhost

# Verify environment
env | grep POSTGRES
```
