# What's new in 2.0

tuvl **2.0.0** (released 20 October 2026; public beta **2.0.0b4** until then — see
[Installation](getting-started/installation.md#20-public-beta)) is a redesign: workflows are graphs of typed **agents**, every run is **durable and
journaled**, and projects are built **spec-first**. There is no 1.x compatibility layer — 1.x
workflows fail to load with an error pointing at the 2.0 format. The full list of changes is in the
[changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

## Highlights

<div class="grid cards" markdown>

-   **Typed agents, eight engines**

    ---

    `code`, `tool` (db / http / storage / mcp), `decide`, `llm`, `loop`, `map`, `human`, `pending` — one
    contract (`inputs`, `outputs`, signals) for all of them. Named ends replace `Response` steps.
    [Engines](internals/engines.md)

-   **Checked before it runs**

    ---

    `tuvl validate` checks contracts, data flow, types and policy (V001–V036) and prints each
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

    The coding agent builds; tuvl referees. `tuvl spec check` checks the spec, `tuvl spec verify`
    checks the build against it, and task status is derived, never self-reported. `tuvl codegen`,
    `tuvl test` and `tuvl lock` are deterministic; `tuvl mcp` and 14 skills for coding agents.
    [Spec-driven development](internals/spec-driven.md)

-   **Fan-out with `map`**

    ---

    `engine: map` runs a child workflow once for every item of a list, a few at a time. Each item is
    a run of its own with its own journal, a crashed parent follows the children it already
    started, and `on_error: collect` keeps going and routes `partial`. `tuvl validate` prices it at
    the child's worst case times `max_items`. [Engines](internals/engines.md#map-a-workflow-for-every-item-of-a-list)

-   **Blob storage**

    ---

    Named stores in `storage/*.yaml` for S3 and compatible services, Azure Blob, Google Cloud
    Storage and local disk, used by `tool: { use: storage }` and `ctx.storage(name)`. Built on
    tuvl's own HTTP client, so no cloud SDK is installed. Keys, prefixes and read-only stores are
    checked before a run (V030–V034). [Blob Storage](internals/storage.md)

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

    `tuvl ship` gates on validation and the lock, pins the engine version and installs only the
    features your project uses; the Helm chart can split API and worker pods.
    [Shipping](getting-started/shipping.md#only-what-the-project-uses)

-   **Project identity and the catalogue**

    ---

    `tuvl init` writes `.tuvl/project.yaml` with a self-checking id, author, type and version. Edit it
    with `tuvl project set` or in Insight, and list the project on [hub.tuvl.io](https://hub.tuvl.io)
    with `tuvl project register` or the Register button. [Project and Catalogue](internals/project.md)

-   **A lighter install: built-in model client**

    ---

    tuvl calls models with its own HTTP client instead of litellm, exports telemetry over
    OTLP/HTTP instead of gRPC, and keeps `mcp`, `redis`, `pgvector` and the development tools out of
    the base install. A bare install is about 65 MB, down from 320 MB in 2.0.0b4, and a shipped
    image adds only the [extras](getting-started/installation.md#extras) the project uses.
    OpenAI, Anthropic, Gemini, Azure OpenAI, Bedrock, Vertex AI, Cohere, Ollama and any
    OpenAI-compatible endpoint or gateway are built in. [Models and Providers](internals/models.md)

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
| `litellm`, `pip install tuvl` pulls everything | built-in model client; features are [extras](getting-started/installation.md#extras) |
| `/models/*` CRUD for every model | CRUD only for models with `spec.api.crud` |

The [examples](examples/example-projects.md) show every pattern on 2.0.
