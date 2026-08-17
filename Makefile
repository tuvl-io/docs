.PHONY: serve sync-internals

# Local docs preview.
serve:
	uv run mkdocs serve

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
