# CLI Overview

The tuvl CLI helps you scaffold, run, and manage tuvl projects.

## Installation

```bash
uv tool install "tuvl[standard]"
```

`tuvl[standard]` includes the dev server, built-in UI, and hot-reload. Use `uv tool install tuvl` for the minimal CLI without UI support.

Verify installation:

```bash
tuvl --version
```

## Commands

| Command | Description |
|---------|-------------|
| `tuvl init` | Create a new project |
| `tuvl dev` | Start development server |
| `tuvl run` | Run production server |
| `tuvl validate` | Validate configuration files |

## Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help message |
| `--version` | Show version number |
| `--project-dir`, `-d` | Specify project directory |

## Quick Start

```bash
# Create new project
tuvl init my-app

# Navigate to project
cd my-app

# Start development server
tuvl dev
```

## Next Steps

- [Commands](commands.md) — Detailed command reference
