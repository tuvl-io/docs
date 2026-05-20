# tuvl Documentation

Source for the [tuvl](https://github.com/tuvl-io/tuvl) documentation site, built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) and published to [tuvl.dev](https://tuvl.dev).

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) — used for dependency management

## Local Development

```bash
# Install dependencies
uv sync

# Serve with live reload (default: http://127.0.0.1:8000)
uv run mkdocs serve

# Serve on a custom port
uv run mkdocs serve --dev-addr 127.0.0.1:8001
```

### Build Static Site

```bash
uv run mkdocs build --strict
```

Output goes to `site/`. The `--strict` flag treats warnings as errors — use it to catch broken links before deploying.

## Structure

```
tuvl_documentation/
├── mkdocs.yml            # Site config, nav, theme, plugins
├── pyproject.toml        # Python deps managed by uv
├── .github/
│   └── workflows/
│       └── publish-docs.yml   # CI: build & deploy on release branch / tag
└── docs/
    ├── index.md          # Home page
    ├── getting-started/  # Installation, quickstart, project structure
    ├── concepts/         # Architecture, workflows, nodes, models, context
    ├── configuration/    # Datasources, LLM presets, environment vars
    ├── cli/              # CLI command reference
    ├── api/              # REST API endpoints & schemas
    ├── sdk/              # Python SDK reference
    ├── tools/            # Built-in tool integrations
    ├── security/         # Auth, secrets, hardening
    ├── examples/         # End-to-end workflow examples
    ├── contributing.md   # Contribution guide
    ├── stylesheets/      # Custom CSS overrides
    └── assets/           # Logo, favicon, images
```

## Adding Pages

1. Create a `.md` file in the appropriate `docs/` subdirectory
2. Register it under `nav:` in `mkdocs.yml`
3. Use root-relative links: `[Link](../concepts/nodes.md)`

## Deployment

Docs are published automatically via GitHub Actions:

| Event | Action |
|-------|--------|
| Push to `release` branch | Build & deploy to GitHub Pages |
| Tag matching `v*` | Build & deploy to GitHub Pages |

See [.github/workflows/publish-docs.yml](.github/workflows/publish-docs.yml) for details.
