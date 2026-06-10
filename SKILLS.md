# TUVL Documentation Skills for AI Agents

---
name: add-documentation-page
description: Create a new documentation page and register it in the MkDocs navigation tree.
options:
  argument-hint: "[file-path]"
---

### Body

1. Create a new Markdown (`.md`) file in the appropriate subdirectory under `docs/` (e.g., `docs/concepts/new-concept.md`).
2. Add a primary H1 heading at the top of the file: `# New Concept`.
3. Open `mkdocs.yml` and locate the `nav:` section.
4. Add the new file to the appropriate category in the navigation tree.
   ```yaml
   nav:
     - Concepts:
         - New Concept: concepts/new-concept.md
   ```
5. Run `uv run mkdocs build --strict` to ensure there are no broken links or orphaned pages.

---
name: serve-docs-locally
description: Start the local MkDocs development server to preview changes.
options:
  allowed-tools: [run_command]
---

### Body

1. Ensure dependencies are installed by running `uv sync`.
2. Run `uv run mkdocs serve`.
3. The site will be available at `http://127.0.0.1:8000` with live reload enabled.

---
name: format-admonition
description: Create callouts or warnings using MkDocs Material admonition syntax.
options:
  argument-hint: "[type]"
---

### Body

1. Use the `!!!` syntax for standard admonitions or `???` for collapsible ones.
2. Specify the type (`note`, `tip`, `info`, `warning`, `danger`, `bug`, `example`, `quote`).
   ```markdown
   !!! warning "Important Notice"
       This is a custom warning block that will be rendered cleanly by MkDocs Material.
   ```
