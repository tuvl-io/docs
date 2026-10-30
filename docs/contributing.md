# Contributing

Thank you for your interest in contributing to tuvl! By taking part you agree to the
[Code of Conduct](https://github.com/tuvl-io/tuvl/blob/main/CODE_OF_CONDUCT.md).

## Before you start

- **A bug fix or a small improvement:** open a pull request.
- **A new feature, or a change to behaviour:** open an issue first and describe what you need. Document kinds,
  engines and artifact types are closed sets, so a design discussion comes before code.
- **A security problem:** do not open an issue; follow the
  [security policy](https://github.com/tuvl-io/tuvl/blob/main/SECURITY.md).

## Development setup

### Prerequisites

- Python 3.13 or 3.14 (see [Installation → Troubleshooting](getting-started/installation.md#troubleshooting))
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
  rule updates the schema (`contract/schema.py`), `tuvl lint project`, codegen, Insight, the docs and
  the changelog together.
- Engines, document kinds and artifact types are closed sets — open an issue before proposing one.
- Add a test for every fix; prefer real Postgres over mocks for runtime behaviour.
- Keep comments to the non-obvious *why*.

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Make your changes** with clear commit messages, each [signed off](#sign-your-commits)
4. **Add tests** for new functionality
5. **Run tests** to ensure everything passes
6. **Submit a PR** with a clear description, linking the issue it closes

A maintainer reviews the pull request on the repository. tuvl is developed in a private repository and each release
is published as a tagged snapshot, so a merged change is applied there and appears in the next tagged release; it
keeps your authorship.

### Sign your commits

tuvl uses the [Developer Certificate of Origin](https://github.com/tuvl-io/tuvl/blob/main/DCO): you certify that you
wrote the change, or have the right to submit it, under the project's license. Add a `Signed-off-by` line to each
commit with `git commit -s`. A pull request whose commits are not signed off will be asked to add it
(`git rebase --signoff main`).

### Commit Messages

Use conventional commits:

```
feat: add an http_<status> route for tool agents
fix: decide rules type-check enum literals
docs: update workflow configuration guide
test: cover per-run transactions
refactor: simplify repository pattern
```

The repository's pull request template lists the checks (tests, docs, sign-off) a reviewer looks for.

## Documentation

The site ([tuvl.dev](https://tuvl.dev)) is MkDocs Material in the `docs` repository. The engine's
`docs/*.md` are the source of the Guide pages; `make sync-internals` copies them into the site.

```bash
uv sync && uv run mkdocs serve
uv run mkdocs build --strict
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/tuvl-io/tuvl/issues)
- **Anything else**: [developer@tuvl.io](mailto:developer@tuvl.io)

## License

By contributing, you agree that your contributions are licensed under the [Apache License, Version 2.0](license.md), and your sign-off certifies the DCO. You keep the copyright in your contribution.
