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
uv tool install tuvl-cli
```

Verify the installation:

```bash
tuvl --version
```

## Installing tuvl Engine

For projects that need the engine directly:

```bash
uv add tuvl-engine
```

Or with pip:

```bash
pip install tuvl-engine
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
git clone https://github.com/tuvl/tuvl.git
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
# Initialize a new project
tuvl init my-project
cd my-project

# Start the development server
tuvl dev
```

You should see output like:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     ✅  Models loaded: 0
INFO:     ✅  Workflows mounted: 0
```

Visit `http://localhost:8000/docs` to see the auto-generated API documentation.

## Next Steps

- [Quickstart Guide](quickstart.md) — Build your first workflow
- [Project Structure](project-structure.md) — Understand the project layout
- [Architecture](../concepts/architecture.md) — Learn how tuvl works
