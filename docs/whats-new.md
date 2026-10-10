# What's new in 2.0

tuvl **2.0.0** is a redesign: workflows are graphs of typed **agents**, every run is **durable and
journaled**, and projects are built **spec-first**. There is no 1.x compatibility layer — 1.x
workflows fail to load with an error pointing at the 2.0 format. The full list of changes is in the
[changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

## Highlights

<div class="grid cards" markdown>

-   **Typed agents, seven engines**

    ---

    `code`, `tool` (db / http / mcp), `decide`, `llm`, `loop`, `human`, `pending` — one contract
    (`inputs`, `outputs`, signals) for all of them. Named ends replace `Response` steps.
    [Engines](internals/engines.md)

-   **Checked before it runs**

    ---

    `tuvl validate` checks contracts, data flow, types and policy (V001–V026) and prints each
    workflow's determinism profile and worst-case token cost.
    [Agentic Manual](internals/tuvl-agentic-manual.md)

-   **Durable runtime**

    ---

    Runs, journal and checkpoints in Postgres; leases so any worker continues any run; waits for
    people and tool approvals; compensation; pause, resume, abort, steer; replay.
    [Runtime](internals/runtime.md)

-   **Rules first, models bounded**

    ---

    `decide` evaluates rules before a decision model and never falls back silently; `loop` has hard
    budgets, per-tool approval and a supervisor; judges are calibrated and cached.
    [Decide](internals/decide.md) · [Loop and tools](internals/loop-and-tools.md) · [Judges](internals/judges.md)

-   **Spec-driven**

    ---

    `tuvl spec analyse` turns intent into contracts and a task plan with derived statuses;
    `tuvl codegen`, `tuvl test`, `tuvl lock` are deterministic; `tuvl mcp` and 13 skills for coding
    agents. [Spec-driven development](internals/spec-driven.md)

-   **Insight 2.0**

    ---

    Specs and task board, a canvas over the same YAML, runs with breakpoints and step mode,
    approvals, change-engine checks against pinned fixtures, judge calibration.
    [Insight](internals/insight.md)

-   **REST, SSE, MCP**

    ---

    gRPC is gone. OpenAPI is generated from contracts; workflows can be exported as MCP tools;
    `@tuvl/client` 2.0 generates typed clients. [API](internals/api.md)

-   **Ship and scale**

    ---

    `tuvl ship` gates on validation and the lock and pins the engine version; the Helm chart can
    split API and worker pods. [CLI](internals/cli.md)

</div>

## From 1.x to 2.0

| 1.x | 2.0 |
|---|---|
| `steps:` with `kind:` step types | `agents:` with an `engine:` (`version: tuvl/v2`) |
| `Functional` + `@node` | `code` agent + `@agent`, typed `In`/`Out` from `tuvl codegen` |
| `ModelOp`, `APICall`, `MCP` | `tool` agent: `use: db \| http \| mcp` |
| `Router` | `decide` agent (rules, then an optional decision model) |
| `Agent` (`mode: completion` / `autonomous`) | `llm` agent / `loop` agent |
| `HumanInTheLoop` + `POST /api/workflows/resume` | `human` agent + `POST /api/approvals/{id}` |
| `Response` step | named ends in `spec.outputs` |
| `kind: test` + LLM judge config | `kind: Test` (offline, mocks, replay) + `type: judge` artifacts |
| Lens / Spectrum | Insight Runs page, breakpoints, step mode, Probe |
| gRPC / gRPC-Web | REST + SSE; MCP export |
| `/models/*` CRUD for every model | CRUD only for models with `spec.api.crud` |

The [examples](examples/example-projects.md) show every pattern on 2.0.
