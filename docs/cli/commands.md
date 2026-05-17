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
├── agents/           # AgentModel configs
│   └── default.yaml  # If LLM configured
├── nodes/            # Python node implementations
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
| `--port` | `8000` | Port number |

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

On each startup tuvl prints a session API key:

```
🚀  tuvl dev server starting...
🔑  Dev API key: <randomly-generated-key>
🌐  UI: http://localhost:8000/ui
```

The UI reads this key from a `<meta name="tuvl-dev-key">` tag injected into the
placeholder `index.html`. It is automatically used for all API calls — you don't
need to log in during development.

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
| `--port` | `8000` | Port number |
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
tuvl run --host 127.0.0.1 --port 8000 --workers 4

# With environment
POSTGRES_HOST=prod-db tuvl run --workers 4
```

---

## `tuvl validate`

Validate configuration files without starting the server.

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
| `--url` | `-u` | `http://localhost:8000` | Base URL of the tuvl server |

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
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | PostgreSQL connection |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Redis connection (optional — see [Redis](../configuration/redis.md)) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `LITELLM_*` | LiteLLM pass-through configuration |

### Example `.env`

```env
# Server
TUVL_HOST=0.0.0.0
TUVL_PORT=8000

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
lsof -i :8000

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
