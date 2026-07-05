.PHONY: serve serve-versioned sync-internals

# Quick content editing — no version selector
serve:
	uv run mkdocs serve

# Full local preview with version selector (mirrors production)
# Deploys current docs into the local gh-pages branch, then serves from it.
serve-versioned:
	@VERSION=$$(grep '^version' pyproject.toml | sed 's/.*= *"\(.*\)"/\1/') && \
	ALIAS=$$(echo "$$VERSION" | grep -qE 'b[0-9]+$$|a[0-9]+$$|rc[0-9]+$$' && echo beta || echo latest) && \
	echo "Deploying $$VERSION (alias: $$ALIAS) to local gh-pages..." && \
	uv run mike deploy --ignore-remote-status --update-aliases --alias-type=copy "$$VERSION" "$$ALIAS" && \
	uv run mike set-default --ignore-remote-status "$$ALIAS" && \
	echo "Serving at http://127.0.0.1:8000" && \
	uv run mike serve

# Mirror the engine repo's internals docs into docs/internals/.
# Run after any engine-docs change; the engine repo is the source of truth.
# The perl pass collapses GitHub-style double-hyphen ToC anchors (from & / —
# in headings) to the single-hyphen slugs mkdocs generates.
sync-internals:
	@for f in tuvl-agentic-manual.md observability.md auth.md autonomous-agent.md \
	  supervisor.md human-in-the-loop.md functional-node.md model-op.md response.md; do \
	  cp "../tuvl-private/docs/$$f" docs/internals/ && \
	  perl -0pi -e 's/\]\(#([a-z0-9-]*?)--/](#$$1-/g while /\]\(#[a-z0-9-]*?--/' "docs/internals/$$f" && \
	  echo "  synced $$f"; \
	done
