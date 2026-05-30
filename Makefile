.PHONY: serve serve-versioned

# Quick content editing — no version selector
serve:
	uv run mkdocs serve

# Full local preview with version selector (mirrors production)
# Deploys current docs into the local gh-pages branch, then serves from it.
serve-versioned:
	@VERSION=$$(grep '^version' pyproject.toml | sed 's/.*= *"\(.*\)"/\1/') && \
	ALIAS=$$(echo "$$VERSION" | grep -qE 'b[0-9]+$$|a[0-9]+$$|rc[0-9]+$$' && echo beta || echo latest) && \
	echo "Deploying $$VERSION (alias: $$ALIAS) to local gh-pages..." && \
	uv run mike deploy --update-aliases "$$VERSION" "$$ALIAS" && \
	uv run mike set-default "$$ALIAS" && \
	echo "Serving at http://127.0.0.1:8000" && \
	uv run mike serve
