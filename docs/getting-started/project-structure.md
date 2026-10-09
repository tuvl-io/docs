# Project structure

```
my-project/
├── pyproject.toml / uv.lock      # Python dependencies (uv)
├── tuvl.lock                     # pinned model ids, artifact hashes, MCP schemas (tuvl lock)
├── .env / .env.example           # secrets and connection settings — never in YAML
├── config.yaml                   # ProjectConfig (spec.analysis_model, …)
├── specs/
│   ├── triage-ticket.md          # intent: flows, policies, acceptance examples
│   └── triage-ticket.tasks.yaml  # TaskPlan — statuses are derived
├── workflows/                    # kind: Workflow (version: tuvl/v2)
├── agents/                       # code agents: one @agent function per file
│   └── _generated/schemas.py     # typed In/Out models (tuvl codegen) — never hand-edited
├── models/                       # kind: ModelDefinition, EmbeddingRegistry, CollectionRegistry
├── llms/                         # kind: AgentModel — type llm or decision
├── datasources/                  # kind: DataSource
├── federation/                   # kind: FederationProvider
├── artifacts/                    # prompts, steering, skills (.md); guardrail, hook, mcp, judge, rules (YAML)
├── tests/
│   ├── triage_ticket/*.yaml      # kind: Test (generated from the spec, or hand-written)
│   └── fixtures/                 # pinned run journals for replay
├── fixtures/judge/               # labelled judge calibration subjects
├── .agents/                      # AGENTS.md + skills for coding agents (tuvl skills update)
└── .tuvl/                        # system.yaml, layout, breakpoints, judge cache, dev session
```

Folder names are conventions: tuvl discovers documents recursively and dispatches them by `kind:`.

## Generated vs written

| You write | tuvl generates |
|---|---|
| `specs/*.md` | `specs/*.tasks.yaml` (spec analysis) |
| workflow YAML (or edit it in Insight) | `agents/_generated/`, code-agent stubs, prompt placeholders |
| code-agent function bodies | `tests/<workflow>/*.yaml` from spec examples |
| hand-written tests, mocks | `tuvl.lock`, `tests/fixtures/*.journal.json` (pinned runs) |

## Document kinds

`Workflow`, `Test`, `TaskPlan` (all `version: tuvl/v2`), `ModelDefinition`, `AgentModel`,
`DataSource`, `RedisConfig`, `EmbeddingRegistry`/`EmbeddingConfig`, `CollectionRegistry`/
`CollectionConfig`, `FederationProvider`, `Artifact`, `ProjectConfig`, `TelemetryConfig`,
`SystemConfig`. Every document is `kind:` + `metadata:` + `spec:`. See the
[Agentic Manual](../internals/tuvl-agentic-manual.md).
