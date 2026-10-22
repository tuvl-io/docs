.PHONY: serve sync-internals

# Where the engine docs live; override to sync from another checkout of the engine repo.
ENGINE_DOCS ?= ../tuvl-private/docs

# Local docs preview.
serve:
	uv run mkdocs serve

# Mirror the engine repo's internals docs into docs/internals/.
# Run after any engine-docs change; the engine repo is the source of truth.
# The perl pass collapses GitHub-style double-hyphen ToC anchors (from & / —
# in headings) to the single-hyphen slugs mkdocs generates.
sync-internals:
	@for f in tuvl-agentic-manual.md runtime.md engines.md decide.md loop-and-tools.md \
	  judges.md spec-driven.md authoring.md insight.md api.md cli.md auth.md observability.md project.md models.md storage.md webhooks.md dev-telemetry.md; do \
	  cp "$(ENGINE_DOCS)/$$f" docs/internals/ && \
	  perl -0pi -e 's/\]\(#([a-z0-9-]*?)--/](#$$1-/g while /\]\(#[a-z0-9-]*?--/' "docs/internals/$$f" && \
	  echo "  synced $$f"; \
	done
