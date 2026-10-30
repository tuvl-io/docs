# Installation

This guide walks you through installing tuvl and its dependencies.

## Prerequisites

Before installing tuvl, ensure you have:

- **Python 3.13 or 3.14** — tuvl 2.0 supports `>=3.13,<3.15`. uv picks a compatible interpreter automatically.
- **uv** — Fast Python package manager (recommended)
- **PostgreSQL** — For data persistence (optional for development)
- **Docker** — Optional. The easiest way to run PostgreSQL, Redis and Laya locally, and required by `tuvl ship` to build the production image
- **Redis** — Optional for `tuvl dev`; needed when you run more than one worker ([why](../configuration/redis.md))
- **Laya (`tuvl/laya-serve`)** — Optional. A self-hosted decision model for `decide` agents; runs as its own container
- **Ollama** — For local LLM inference (optional)

!!! note "What you actually need"
    To try tuvl you need Python and uv, and a PostgreSQL database. Everything else above is opt-in: Redis only matters for multi-worker deployments, and Laya only if a `decide` agent uses it as its decision model.

!!! note "Python 3.14"
    tuvl 1.x was held to Python 3.13 because its token library (`biscuit-python`) had no 3.14 builds. tuvl 2.0 signs tokens as standard JWTs and runs on 3.13 and 3.14 on Linux, macOS and Windows.

### Installing uv

=== "macOS / Linux"

    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```

=== "Windows"

    ```powershell
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    ```

=== "pip"

    ```bash
    pip install uv
    ```

## Upgrading from 1.x

`uv tool install tuvl` installs tuvl 2.0.0. There is no 1.x compatibility layer: a 1.x workflow fails to
load with an error pointing at the 2.0 format (see [what's new](../whats-new.md)). To move an existing
install, run `uv tool upgrade tuvl`. The TypeScript client is `npm install @tuvl/client`.

## Installing tuvl CLI

Install the tuvl CLI globally using uv:

```bash
# Base CLI only
uv tool install tuvl

# With dev server and built-in UI (recommended)
uv tool install "tuvl[standard]"
```

!!! tip
    `tuvl[standard]` includes the dev server (`tuvl dev`), the built-in **tuvl insight** UI, hot-reload support, the development tools (`tuvl generate code`, `tuvl run tests`, `tuvl serve mcp`) and every extra below. The base install is the production server and is about 65 MB installed. `tuvl ship` builds production images from it and adds only the extras your project uses.

Verify the installation:

```bash
tuvl --version
```

## Installing tuvl as a Project Dependency

For projects that embed the engine directly:

```bash
# Base engine
uv add tuvl

# With dev server and built-in UI
uv add "tuvl[standard]"
```

Or with pip:

```bash
pip install "tuvl[standard]"
```

## Extras

The base `tuvl` has no package for a feature you may not use. Install the extra when you use the feature:

| Extra | Adds | You need it for |
|---|---|---|
| `tuvl[mcp]` | `mcp` | `use: mcp` tools, a `loop` calling an MCP server, exporting a workflow as an MCP tool, `tuvl serve mcp` |
| `tuvl[redis]` | `redis` | a `type: redis` datasource |
| `tuvl[vector]` | `pgvector` | collections, embeddings and `tuvl.data_search` / `tuvl.data_ingest` |
| `tuvl[otel-grpc]` | OTLP gRPC exporter | `TUVL_OTLP_PROTOCOL=grpc` (HTTP/protobuf is the default and needs nothing) |
| `tuvl[codegen]` | `libcst` | `tuvl generate code` and `tuvl init --sample` |
| `tuvl[test]` | `aiosqlite` | `tuvl run tests` |
| `tuvl[review]` | `ruff` | `tuvl review code` |
| `tuvl[pdf]` | `pypdf` | `tuvl import idea` of PDF ideas (Word and Markdown need nothing extra) |
| `tuvl[tui]` | `textual` | the terminal UI that `tuvl dev` starts on a terminal |

```bash
uv add "tuvl[mcp,redis]"
```

Using a feature without its extra fails with the command to run, for example
`pip install 'tuvl[mcp]'`. You do not choose extras for production by hand: [`tuvl ship`](shipping.md#only-what-the-project-uses)
reads the project and installs exactly the ones it needs. Model providers and blob storage (S3,
Azure, GCS, local disk) are built in and need no extra.

## Optional Dependencies

### PostgreSQL

=== "macOS (Homebrew)"

    ```bash
    brew install postgresql@16
    brew services start postgresql@16
    ```

=== "Ubuntu/Debian"

    ```bash
    sudo apt update
    sudo apt install postgresql postgresql-contrib
    sudo systemctl start postgresql
    ```

=== "Docker"

    ```bash
    docker run -d \
      --name tuvl-postgres \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=tuvl \
      -p 5432:5432 \
      postgres:16-alpine
    ```

### Redis (optional)

Redis shares OAuth state and the token-revocation list between workers. A single `tuvl dev`
process works without it (an in-process fallback is used); add it before running more than one
worker. Install `tuvl[redis]` to use it. See [Redis configuration](../configuration/redis.md) for the datasource file.

=== "macOS (Homebrew)"

    ```bash
    brew install redis
    brew services start redis
    ```

=== "Ubuntu/Debian"

    ```bash
    sudo apt install redis-server
    sudo systemctl start redis-server
    ```

=== "Docker"

    ```bash
    docker run -d --name tuvl-redis -p 6379:6379 redis:7-alpine
    ```

Then add `datasources/redis-primary.yaml` with `type: redis`, `host: ${REDIS_HOST:localhost}`.

### Laya decision server (optional)

[Laya](https://hub.docker.com/r/tuvl/laya-serve) is an open-weight model that picks one value of a
`decide` agent's enum with a confidence. It runs on CPU in its own container, offline, with
verified weights baked in. Use it when you want decisions made on your own infrastructure instead
of calling a hosted model.

The quickest route is to let `tuvl init` scaffold it:

```bash
tuvl init my-project --decision-model laya -y
cd my-project
docker compose up -d laya        # serves on http://localhost:8000
```

This writes `llms/laya.yaml` (a `provider: laya` AgentModel), `LAYA_API_*` entries in `.env` and a
`compose.yaml`. To run the container by hand:

=== "English only (smaller)"

    ```bash
    docker run -d --name laya -p 127.0.0.1:8000:8000 tuvl/laya-serve:0.4.7-1-en
    ```

=== "English + multilingual"

    ```bash
    docker run -d --name laya -p 127.0.0.1:8000:8000 tuvl/laya-serve:0.4.7-1
    ```

| Image | Use with | Memory |
|---|---|---|
| `…-en` | `model: english` | about 2 GiB |
| full | `model: auto` or `multilingual` | about 3.5 GiB |

The image is about 2.7 GB (CPU PyTorch plus the weights), amd64 and arm64. Check it is up with
`curl localhost:8000/health`. Details, checkpoints and settings are in
[AI Models → Laya](../configuration/agents.md) and [Decide](../internals/decide.md).

### Ollama (Local LLM)

=== "macOS"

    ```bash
    brew install ollama
    ollama serve
    
    # In another terminal, pull a model
    ollama pull llama3
    ```

=== "Linux"

    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ollama serve
    
    # In another terminal
    ollama pull llama3
    ```

=== "Docker"

    ```bash
    docker run -d \
      --name ollama \
      -p 11434:11434 \
      -v ollama:/root/.ollama \
      ollama/ollama
    
    docker exec ollama ollama pull llama3
    ```

## Verifying Installation

Create the sample project and run its checks:

```bash
tuvl init my-project --sample --preset gemini -y   # or openai | anthropic | ollama
cd my-project
tuvl lint project --strict
tuvl run tests
tuvl dev --auto-login
```

`tuvl dev` serves the engine on port 8885 and **Insight** at `http://127.0.0.1:8885/insight/`.
With `--auto-login` this machine skips the key screen; otherwise paste the session key, stored in
`.tuvl/.dev-session` (`tuvl dev --show-key` prints it).

## Troubleshooting

### Windows: port already in use or permission denied

**Symptom** — `tuvl dev` fails to start the engine on its default port (`8885`) with one of:

- `[Errno 48] Address already in use` / `Only one usage of each socket address … is normally permitted`
- `PermissionError: [WinError 10013] An attempt was made to access a socket in a way forbidden by its access permissions`

**Why this happens** — either another process is already bound to the port, **or** — common on Windows — the port falls inside a range Windows has *reserved* for dynamic allocation. Hyper-V, WSL 2, and Docker Desktop routinely reserve large TCP ranges; binding a port inside a reserved range fails with `WinError 10013` even though nothing is actively listening on it.

Inspect the reserved ranges:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

If `8885` sits inside an excluded range (or is otherwise taken), run tuvl on a free port:

=== "One-off flag"

    ```powershell
    tuvl dev --port 8899
    ```

=== "Environment variable"

    ```powershell
    # Persist a different port for all tuvl commands in this shell
    $env:TUVL_DEV_PORT = "8899"
    tuvl dev
    ```

!!! tip
    The port also appears in the login URL tuvl prints (`http://127.0.0.1:<port>/insight/`). If you rely on the OAuth callback flow, align `TUVL_OAUTH_BASE_URL` with the port you chose (defaults to `http://localhost:8885`).

The default `8885` spells **T·U·V·L** on a phone keypad and deliberately avoids the crowded `8000`/`8080`/`8888` range — but any free, non-reserved port works.

## Next Steps

- [Quickstart Guide](quickstart.md) — Build your first workflow
- [Code generation](codegen.md) — `tuvl generate code`: typed schemas, stubs and tests
- [Shipping to production](shipping.md) — `tuvl ship`: image, Helm chart, Laya and secrets
- [Project Structure](project-structure.md) — Understand the project layout
- [Agentic Manual](../internals/tuvl-agentic-manual.md) — how tuvl projects are written
