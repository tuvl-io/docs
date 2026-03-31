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

Start the development server with auto-reload.

### Usage

```bash
tuvl dev [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project directory |
| `--host` | `0.0.0.0` | Bind address |
| `--port` | `8000` | Port number |
| `--reload` | `true` | Enable auto-reload |

### Examples

```bash
# Start with defaults
tuvl dev

# Custom port
tuvl dev --port 3000

# Specific project
tuvl dev --project-dir ./services/api

# Disable reload
tuvl dev --reload false
```

### Output

```
INFO:     tuvl engine starting...
INFO:     ✅  Models loaded: 3
INFO:     ✅  Workflows mounted: 2 route(s)
INFO:     Uvicorn running on http://0.0.0.0:8000
```

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

## Environment Variables

The CLI respects these environment variables:

| Variable | Description |
|----------|-------------|
| `TUVL_PROJECT_DIR` | Default project directory |
| `TUVL_HOST` | Default bind address |
| `TUVL_PORT` | Default port |
| `POSTGRES_*` | Database configuration |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `LITELLM_*` | LiteLLM configuration |

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
