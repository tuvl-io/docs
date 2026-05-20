# Installation

This guide walks you through installing tuvl and its dependencies.

## Prerequisites

Before installing tuvl, ensure you have:

- **Python 3.12+** — tuvl requires Python 3.12 or later
- **uv** — Fast Python package manager (recommended)
- **PostgreSQL** — For data persistence (optional for development)
- **Ollama** — For local LLM inference (optional)

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
│ Starting tuvl engine in dev mode on port 8000.                         │
│                                                                        │
│ Security key                                                           │
│  XXXX-XXXX-XXXX-XXXX                                                   │
│                                                                        │
│ Open http://127.0.0.1:8000/ui/ and paste the key above.               │
╰────────────────────────────────────────────────────────────────────────╯
```

Open `http://127.0.0.1:8000/ui/` in your browser and paste the printed security key to access the tuvl insight developer portal.

## Next Steps

- [Quickstart Guide](quickstart.md) — Build your first workflow
- [Project Structure](project-structure.md) — Understand the project layout
- [Architecture](../concepts/architecture.md) — Learn how tuvl works
