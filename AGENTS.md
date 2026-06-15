# tuvl_documentation Agent Rules

This directory contains the source code for the TUVL documentation website (`tuvl.dev`), built using **MkDocs Material**. 

## 1. Environment & Setup
- **Dependency Management:** The project uses `uv`. 
- **Commands:** 
  - Install dependencies: `uv sync`
  - Run the local dev server: `uv run mkdocs serve` (accessible at `127.0.0.1:8000`)
  - Build the site strictly: `uv run mkdocs build --strict` (always use strict to catch broken links).

## 2. Directory Structure Conventions
- **Configuration:** `mkdocs.yml` contains all site settings, plugins, and the navigation tree (`nav:`).
- **Documentation Source:** All Markdown files live under the `docs/` directory.
- **Assets:** Images go in `docs/assets/`.
- **CSS Overrides:** Located in `docs/stylesheets/`.

## 3. Formatting & Linking Rules
- **Markdown Flavor:** Uses standard Markdown + MkDocs Material extensions (Admonitions, Code Annotations, Content Tabs).
- **Links:** Always use root-relative links between documents (e.g., `[Link](../concepts/nodes.md)`).
- **Frontmatter:** MkDocs does not strictly require YAML frontmatter for every page, but title headings (`#`) are mandatory.

## 4. Workflows
- **Adding a Page:** You must ALWAYS register any new markdown file created in `docs/` under the `nav:` section in `mkdocs.yml`, otherwise it will be considered an orphaned page.
- **Deployment:** Handled automatically via `.github/workflows/publish-docs.yml` on push to `release` or version tags.
