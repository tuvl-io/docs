# Installation

This guide walks you through installing tuvl and its dependencies.

## Prerequisites

Before installing tuvl, ensure you have:

- **Python 3.13 or 3.14** — tuvl 2.0 supports `>=3.13,<3.15`. uv picks a compatible interpreter automatically.
- **uv** — Fast Python package manager (recommended)
- **PostgreSQL** — For data persistence (optional for development)
- **Ollama** — For local LLM inference (optional)

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

## 2.0 public beta

tuvl **2.0.0** is released on **20 October 2026**. Until then, 2.0 is available as the public beta
**2.0.0b2**. A plain `uv tool install tuvl` still installs the latest 1.x release, so ask for the
beta explicitly:

```bash
# CLI + dev server + Insight (recommended)
uv tool install --prerelease allow "tuvl[standard]==2.0.0b2"

# CLI only
uv tool install "tuvl==2.0.0b2"
```

`--prerelease allow` is needed because uv only takes a pre-release for packages you name yourself,
and `tuvl[standard]` pulls in `tuvl-insight 2.0.0b2` indirectly.

The TypeScript client has a matching beta on npm's `beta` channel:

```bash
npm install @tuvl/client@beta     # 2.0.0-beta.1
```

From 20 October the commands below install 2.0.0 directly. Report beta issues on
[GitHub](https://github.com/tuvl-io/tuvl/issues).

## Installing tuvl CLI

Install the tuvl CLI globally using uv:

```bash
# Base CLI only
uv tool install tuvl

# With dev server and built-in UI (recommended)
uv tool install "tuvl[standard]"
```

!!! tip
    `tuvl[standard]` includes the dev server (`tuvl dev`), the built-in **tuvl insight** UI, and hot-reload support. Use the base install for production-only deployments where the UI is not needed.

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
tuvl validate --strict
tuvl test
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
- [Project Structure](project-structure.md) — Understand the project layout
- [Agentic Manual](../internals/tuvl-agentic-manual.md) — how tuvl projects are written
