# Why tuvl

**Deterministic execution. Zero vibes.** tuvl runs typed workflows of agents (code, database and HTTP tools, rules, models, bounded tool loops and people) on a durable, journaled runtime, built from specs. Every route is declared, every model call is budgeted and every run is recorded. The engine refuses anything the contract doesn't declare.

This page holds the detail behind the four guarantees on [tuvl.io](https://tuvl.io): how execution, data and access are fenced, how tuvl compares with other tools, and what it means for each person who has to say yes.

## Workflow execution: every path is declared

- **Seven engines, one contract.** Every agent declares typed `inputs`, `outputs` and the signals it emits. Its engine is `code`, `tool`, `decide`, `llm`, `loop`, `human` or `pending`. Custom logic goes into a `code` agent (a typed Python function), not into the framework.
- **Checked before it runs.** `tuvl validate` applies 29 rules covering routes, data flow, types, expressions and policy. It prints each workflow's determinism profile and worst-case token cost. Every signal must be routed; there are no implicit edges. `tuvl spec check` and `tuvl spec verify` hold the build to its spec in the same way.
- **Rules before models.** A `decide` agent evaluates its rules first and asks a decision model only when none match. A typed-decision model such as self-hosted Laya returns calibrated probabilities, not text. An unavailable model is an `error`, never a silent fallback, and a doubtful answer routes `low_confidence`.
- **Models stay bounded.** `llm` and `loop` agents must declare token, time and iteration budgets. A model can only pick one of the routes you declared: its choice is constrained to the declared signals, and anything else routes `parse_error`. Every abnormal exit (`max_iterations`, `budget_exceeded`, `timeout`, `aborted`) is a routable signal.
- **Loops are governed.** Tools are agents, child workflows or allow-listed MCP tools, with schemas derived from their contracts. A risky call pauses for a person's approval, a supervisor can pause, steer or abort, and calibrated judges fail closed.

## Data and state: every access is fenced

- **Agents see only their inputs.** Undeclared context is invisible. An output that doesn't match the contract is a `contract_violation`, not a surprise further down the workflow.
- **Model allowlist.** A workflow can read and write only the models listed in `spec.models`. This is checked by the validator and again at runtime.
- **Durable by default.** Each step's writes commit with its checkpoint. A crashed worker's run resumes from the last checkpoint, and a rollback end compensates completed agents in reverse order.
- **PII never reaches a model.** Fields marked `secure: true` are refused as model inputs at validation, and redacted in the journal and in exports.
- **Reproducible.** `tuvl.lock` pins model ids, artifact hashes and MCP tool schemas. `tuvl ship` refuses a stale lock and pins the engine version.

## Security: fail closed, by construction

### Callers: no accidental public endpoints

- **Deny by default.** In production, every way to start a run requires a verified token: the workflow's route, the run API and MCP export. This holds even when the YAML declares no scope or group. Forgetting auth config doesn't open an endpoint; it locks one.
- **Public is a declaration, not an omission.** `trigger.http.public: true` is the only way to serve anonymous traffic. Combining it with a required scope or group is a validation error.
- **Gated approvals.** A person deciding a human step needs the `approvals:decide` scope and the step's `required_group`. On a group-gated step they can't be the person who started the run. Every decision is journaled with who made it. See [IAM](security/iam.md).

### Data: read and write are separate grants

- **CRUD is opt-in.** A model gets REST routes only for the operations it lists in `spec.api.crud`. `read`, `write` and `delete` are independent grants, carried as signed facts in offline-verifiable Biscuit tokens.
- **Group-pinned models.** `spec.access` can restrict a model to named IAM groups per tier. A caller needs the scope *and* the membership; the only bypass is the explicit `iam:admin` grant.
- **Restrictions cascade down, never up.** Declare who may read, and the write and delete tiers inherit that fence unless you narrow them further.

### Surface: the API you don't declare doesn't exist

- **Kill the CRUD plane entirely.** One `SystemConfig` line unmounts every auto-generated `/models/*` route. The routes are absent from the router and the OpenAPI schema, rather than hidden behind a 403.
- **No signing key, no boot.** A production engine without its Biscuit key refuses to start rather than fall back to anything weaker.
- **Dev conveniences can't leak.** The dev-mode superuser shortcut hard-exits the process if it's ever enabled in production.

## How tuvl compares

| | Visual flow builders<br>*Langflow · Flowise · Dify* | Code-first frameworks<br>*LangGraph · CrewAI · Agents SDK* | tuvl |
|---|---|---|---|
| **Source of truth** | The canvas; exports are JSON blobs | Your codebase | Specs and YAML in git; Insight's canvas edits the same files |
| **What you ship** | A flow hosted inside the tool | A library inside an app you still build | A mounted API (routes, models, auth, telemetry), live the day the YAML merges |
| **When it breaks** | At runtime, inside the tool | Wherever the Python throws | Checked before it runs; declared failures route as signals; a crashed worker's run resumes from its last checkpoint |
| **Can the model invent a path?** | Components are open-ended | The graph constrains it; the app around it is code | No: it picks from the routes you declared |
| **Auth and tenancy** | The tool's API keys; the rest is yours | Bring your own | Scoped tokens per route; row-level tenancy |
| **Integrations** | Connector catalogs | Ecosystems, plus whatever you write | MCP tools in, workflows out as MCP tools; plain HTTP for everything else |
| **Lock-in and exit** | Flows live in the tool's format and runtime | A library you can pin, fork or vendor (the cleanest exit here) | A YAML dialect you adopt, whose majors land on your calendar too. MIT engine; your data stays in your Postgres |
| **Path to production** | Export, then host around it | Your Dockerfile, your infra | One command to a container and Helm chart (`tuvl ship`) |

Visual builders are a good canvas for a human exploring. Code-first frameworks are a good library inside an app you own. tuvl is the backend itself, declared. When the closed set isn't enough, a `code` agent drops to one typed Python function that stays inside the contract: its exits route through declared signals, and its database access stays allowlisted.

## Who it's for

**Engineers: a mechanism you can audit.**
Typed agent contracts and seven engines form a closed set, checked by 29 validation rules before anything runs. The stack is FastAPI, Postgres with pgvector, LiteLLM and OpenTelemetry. Durable runs are rows in your Postgres, with no extra workflow server and no torch or langchain dependency. Run `tuvl dev` on a laptop, and `tuvl ship` for a container and Helm chart. Start with the [Agentic Manual](internals/tuvl-agentic-manual.md).

**Product managers: scope that ships this sprint.**
Start from a spec in plain language. The task board's progress is derived from the project, not self-reported. `human` agents put sign-off *inside* the workflow: the run waits, durably, for days if needed, and the approval is on record. When someone asks "why did the AI do that?", you open the run and show them.

**Stakeholders: risk with a fence around it.**
MIT-licensed and open source, with no per-seat or per-call platform fee; the only spend is your own infrastructure and model tokens. Your data stays in your Postgres, PII marked secure never reaches a model, and decisions can run on a self-hosted model in your own cluster. The business logic is portable YAML and the runtime is a standard Python wheel, so adopting tuvl doesn't strand you in it.

## See it built

The [examples](examples/example-projects.md) range from one typed model call (Invoice Extraction API) to durable human review (Content Moderation Pipeline) and a supervised investigation loop with a calibrated judge and group-gated compliance decisions (KYC Onboarding). Or run any of them in a throwaway sandbox at [try.tuvl.online](https://try.tuvl.online).
