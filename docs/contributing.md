# Contributing

Thank you for your interest in contributing to tuvl!

## Development setup

### Prerequisites

- Python 3.13 (`>=3.13,<3.14`; see [Installation → Troubleshooting](getting-started/installation.md#troubleshooting))
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16+ with pgvector, and Redis
- Node.js 20+ and pnpm (Insight)

### Install and run

```bash
git clone https://github.com/tuvl-io/tuvl.git && cd tuvl
uv sync --extra standard --group dev
make ui-install

uv run tuvl init demo --sample -y
uv run tuvl dev -d demo --auto-login       # Insight at http://localhost:8885/insight
```

The repository's `AGENTS.md` maps the code: `src/tuvl/contract/` (document model, type and expression
languages), `validate/`, `runtime/` (durable runner, engines, journal), `api/` (REST, SSE, MCP, dev
API), `spec/`, `codegen/`, `lock/`, `testing/`, `cli/`, `core/` (config, models, auth, artifacts),
and `ui/` (Insight).

## Checks

```bash
make check                 # ruff format + lint on src/
make typecheck-gate        # mypy on the gated packages (must stay clean)
TUVL_TEST_PG_URL=postgresql+asyncpg://tuvl:tuvl@localhost:5432/tuvl_test uv run pytest
cd ui && pnpm exec tsc -b && pnpm test     # Insight unit tests
scripts/insight-smoke.sh   # Insight browser tests (Playwright), needs a built UI and Postgres
```

Tests that need Postgres skip without `TUVL_TEST_PG_URL`. CI runs all of the above.

## Changing behaviour

- The 2.0 specification is the contract: a change to a document kind, engine, signal or validation
  rule updates the schema (`contract/schema.py`), `tuvl validate`, codegen, Insight, the docs and
  the changelog together.
- Engines, document kinds and artifact types are closed sets — open an issue before proposing one.
- Add a test for every fix; prefer real Postgres over mocks for runtime behaviour.
- Keep comments to the non-obvious *why*.

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Make your changes** with clear commit messages
4. **Add tests** for new functionality
5. **Run tests** to ensure everything passes
6. **Submit a PR** with a clear description

### Commit Messages

Use conventional commits:

```
feat: add an http_<status> route for tool agents
fix: decide rules type-check enum literals
docs: update workflow configuration guide
test: cover per-run transactions
refactor: simplify repository pattern
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style
- [ ] Self-reviewed code
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Documentation

The site ([tuvl.dev](https://tuvl.dev)) is MkDocs Material in the `docs` repository. The engine's
`docs/*.md` are the source of the Guide pages; `make sync-internals` copies them into the site.

```bash
uv sync && uv run mkdocs serve
uv run mkdocs build --strict
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/tuvl-io/tuvl/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tuvl-io/tuvl/discussions)
- **Discord**: [Join our Discord](https://discord.gg/tuvl)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
