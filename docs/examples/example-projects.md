# Example Projects

Five complete, runnable projects live in the public
[`tuvl-io/examples`](https://github.com/tuvl-io/examples) repository. Each was
built from a `project-specification.md` in its directory, passes
`tuvl validate` with zero warnings, and runs with `tuvl dev` — clone one, point
it at your Postgres, and make it yours.

| Project | Difficulty | What it demonstrates |
|---|---|---|
| [`invoice-extraction-api`](https://github.com/tuvl-io/examples/tree/release/invoice-extraction-api) | Easy | Raw invoice text → validated Postgres records: one `Agent` step with typed JSON output, a deterministic totals check, `enum` currencies, a `secure` tax id |
| [`knowledge-base-qa`](https://github.com/tuvl-io/examples/tree/release/knowledge-base-qa) | Easy–Medium | RAG on the built-in rails — `DataIngest`/`DataSearch` over pgvector, cited answers, zero custom Python, a `@tuvl/client` demo script |
| [`content-moderation-pipeline`](https://github.com/tuvl-io/examples/tree/release/content-moderation-pipeline) | Medium | LLM classification, deterministic `match:` region routing, and group-gated human review — the submitter cannot approve their own content |
| [`mcp-research-agent`](https://github.com/tuvl-io/examples/tree/release/mcp-research-agent) | Medium–Complex | An autonomous-mode `Agent` driving an MCP fetch tool to a cited research brief, bounded by a token budget, with live loop progress over the SDK |
| [`kyc-onboarding`](https://github.com/tuvl-io/examples/tree/release/kyc-onboarding) | Complex | A supervised autonomous investigator (fail-closed LLM judge), policy RAG, compliance-gated approval, PII masking, versioned risk schemas |

Together the five exercise every step kind and subsystem: all eight step kinds
(both `Agent` modes), RAG, `spec.supervisor`, `HumanInTheLoop` with
`auth.required_group`, MCP over stdio, model versioning, `secure: true` masking,
IAM scopes and groups, and the `tuvl test` framework with LLM-judge evaluations.

## Running one

```bash
uv tool install "tuvl[standard]>=2026.4.0.0"
git clone https://github.com/tuvl-io/examples.git
cd examples/<project-name>
cp .env.example .env        # fill in DATABASE_URL, GEMINI_API_KEY, …
tuvl validate
tuvl dev                    # → http://localhost:8000 (+ /insight)
```

Per-project infrastructure needs (database, pgvector, API keys, MCP tooling)
are catalogued in the repo's
[`REQUIREMENTS.md`](https://github.com/tuvl-io/examples/blob/release/REQUIREMENTS.md).
Contributions follow
[`AGENTS.md`](https://github.com/tuvl-io/examples/blob/release/AGENTS.md) —
each project ships a specification a human or coding agent can implement
unaided.
