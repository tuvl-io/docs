# Installation

This guide walks you through installing tuvl and its dependencies.

## Prerequisites

Before installing tuvl, ensure you have:

- **Python 3.13** — tuvl targets Python 3.13 (`>=3.13,<3.14`). Python 3.14 is **not yet supported** — see [Troubleshooting](#troubleshooting) for the reason and the fix.
- **uv** — Fast Python package manager (recommended)
- **PostgreSQL** — For data persistence (optional for development)
- **Ollama** — For local LLM inference (optional)

!!! warning "Use Python 3.13"
    tuvl pins `requires-python = ">=3.13,<3.14"`. A clean `uv tool install "tuvl[standard]"` picks a compatible interpreter automatically. If you force the install into a pre-created **Python 3.14** environment it will fail while building `biscuit-python` — jump to [Python 3.14: `biscuit-python` build failure](#python-314-biscuit-python-build-failure).

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

## Development Installation

For contributing to tuvl or developing locally:

```bash
# Clone the repository
git clone https://github.com/tuvl-io/tuvl.git
cd tuvl

# Install dependencies
cd engine && uv sync
cd ../cli && uv sync

# Run the development server
cd ../engine && uv run tuvl dev
```

## Verifying Installation

Create a test project to verify everything works:

```bash
# Scaffold with sample files (recommended)
tuvl init my-project --sample
cd my-project

# Start the development server
tuvl dev

# Options: custom port or project directory
# tuvl dev --port 3000
# tuvl dev --project-dir /path/to/project
```

You should see output like:

```
╭─────────────────────────────── tuvl dev ───────────────────────────────╮
│ Starting tuvl engine in dev mode on port 8885.                         │
│                                                                        │
│ Security key                                                           │
│  XXXX-XXXX-XXXX-XXXX                                                   │
│                                                                        │
│ Open http://127.0.0.1:8885/insight/ and paste the key above.          │
╰────────────────────────────────────────────────────────────────────────╯
```

Open `http://127.0.0.1:8885/insight/` in your browser and paste the printed security key to access the tuvl insight developer portal.

## Troubleshooting

### Python 3.14: `biscuit-python` build failure

**Symptom** — installing on Python 3.14 (typically Windows) aborts while building `biscuit-python`:

```text
× Failed to build biscuit-python==0.4.0
  ╰─▶ Call to maturin.build_wheel failed (exit code: 1)
      error: the configured Python interpreter version (3.14) is newer than
      PyO3's maximum supported version (3.13)
hint: biscuit-python (v0.4.0) was included because tuvl (v1.0.0) depends on biscuit-python
```

**Why this happens** — tuvl uses [Biscuit](https://www.biscuitsec.org/) tokens for its capability-based auth, via the `biscuit-python` package. `biscuit-python` is a native extension written in Rust (built with `maturin` + PyO3), so installing it needs a **pre-compiled wheel** for your exact Python version and platform. `biscuit-python==0.4.0` publishes wheels up to **CPython 3.13** only — there is no 3.14 Windows wheel yet. When no wheel matches, uv/pip falls back to compiling from Rust source, and **PyO3 0.24.1 refuses to build against any Python newer than 3.13** and stops.

This is exactly why tuvl pins `requires-python = ">=3.13,<3.14"`. A correctly formed install (`uv tool install "tuvl[standard]"`) selects a compatible interpreter automatically and never reaches this build. You only hit the error above when you install into an environment that was **already created with Python 3.14** — uv then honours that interpreter instead of choosing 3.13.

#### Fix A — use Python 3.13 (recommended, zero friction)

Wheels exist for 3.13, so the install is a fast binary download with no Rust toolchain involved.

=== "uv tool (global CLI)"

    ```powershell
    # Install a 3.13 interpreter (uv manages it for you) and pin the tool to it
    uv python install 3.13
    uv tool install --python 3.13 "tuvl[standard]"
    ```

=== "uv venv (project)"

    ```powershell
    # Recreate the environment explicitly on 3.13
    uv venv --python 3.13 .venv
    .\.venv\Scripts\activate
    uv pip install "tuvl[standard]"
    ```

Verify:

```powershell
tuvl --version
```

#### Fix B — force the build on Python 3.14 (advanced, unsupported)

If you must stay on 3.14, you can tell PyO3 to skip its forward-compatibility check and build against the stable ABI anyway. This is **not officially supported** — it requires a working **Rust toolchain** (`rustc`/`cargo`) and may produce a binary that behaves subtly differently. Prefer Fix A.

=== "PowerShell"

    ```powershell
    $env:PYO3_USE_ABI3_FORWARD_COMPATIBILITY = "1"
    uv pip install "tuvl[standard]"
    ```

=== "cmd.exe"

    ```bat
    set PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
    uv pip install "tuvl[standard]"
    ```

!!! note
    Native 3.14 support will land once `biscuit-python` ships 3.14 wheels (and PyO3 raises its supported ceiling). Until then, **3.13 is the supported runtime.**

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
- [Architecture](../concepts/architecture.md) — Learn how tuvl works
