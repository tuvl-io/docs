# tuvl Documentation

This directory contains the documentation for tuvl, built with [MkDocs](https://www.mkdocs.org/) and the [Material theme](https://squidfunk.github.io/mkdocs-material/).

## Local Development

### Install Dependencies

```bash
uv sync
```

### Serve Locally

```bash
uv run mkdocs serve
```

Visit `http://localhost:8000` to view the documentation.

### Build Static Site

```bash
uv run mkdocs build
```

The built site will be in the `site/` directory.

## Structure

```
documentation/
├── mkdocs.yml           # MkDocs configuration
├── pyproject.toml       # Python dependencies (uv)
├── README.md           # This file
└── docs/
    ├── index.md         # Home page
    ├── getting-started/ # Installation, quickstart
    ├── concepts/        # Architecture, workflows, nodes
    ├── configuration/   # Datasources, agents
    ├── cli/             # CLI reference
    ├── api/             # API reference
    ├── examples/        # Complete examples
    ├── contributing.md  # Contribution guide
    ├── stylesheets/     # Custom CSS
    └── assets/          # Images, favicon
```

## Adding Pages

1. Create a new `.md` file in the appropriate directory
2. Add the page to `nav` in `mkdocs.yml`
3. Cross-reference with relative links: `[Link](../other-page.md)`

## Writing Guidelines

- Use clear, concise language
- Include code examples with language hints
- Add diagrams using Mermaid when helpful
- Cross-reference related pages

## Deployment

The documentation is automatically deployed on push to `main` using GitHub Pages.

To manually deploy:

```bash
uv run mkdocs gh-deploy
```
