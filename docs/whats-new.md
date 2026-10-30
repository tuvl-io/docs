# What's new in 2.0

tuvl **2.0.0** is a redesign: workflows are graphs of typed **agents**, every run is **durable and
journaled**, and projects are built **spec-first**. There is no 1.x compatibility layer — 1.x
workflows fail to load with an error pointing at the 2.0 format. The full list of changes is in the
[changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

!!! info "License: Apache 2.0"
    tuvl is licensed under the **Apache License, Version 2.0**, which includes an express patent grant.
    Using, modifying and selling software built on tuvl is free. [The license](license.md)

## New in 2.0.0b10

<div class="grid cards" markdown>

-   **Answers that stream**

    ---

    `llm: { stream_tokens: true }` sends the text of one output field to the run's event stream while the model writes it.
    The result, validation, token count and retries are the same as without it; a rejected or retried answer tells the client
    to drop the draft; and the validator refuses it next to an output guardrail, because text a guardrail could still refuse
    must not be shown. Insight shows the draft under the running step, and `@tuvl/client` has `handle.onToken(...)`.
    Existing clients are unchanged: drafts come only with `?drafts=true`.
    [API](internals/api.md), [Engines](internals/engines.md)

-   **Steps that run side by side**

    ---

    The new `parallel` engine runs two to sixteen read-only branches (database reads, HTTP GETs, storage reads, `llm`, read-only
    `code`) at the same time and joins their outputs, so a step takes as long as its slowest branch. The branches are declared in
    the YAML, checked before anything runs (V040-V042), priced as the sum of their budgets, journaled branch by branch and mocked
    one by one in offline tests; a worker killed mid-fan-out is resumed on another. A `loop` also runs the read-only tool calls of
    one model turn together. [Engines](internals/engines.md#parallel-different-read-only-lookups-at-the-same-time)

-   **Agents that remember, under your rules**

    ---

    `llm.memory` and `loop.memory` put an owner's earlier turns into the prompt and store the result afterwards. The owner is
    the signed-in user, the tenant or a named input, chosen in YAML and never by the model; recalled text is fenced as data;
    secure fields are refused; the recalled tokens count against the policy's cost cap; and every recall is journaled. A person
    can be forgotten (`tuvl prune memory`, or a button in Insight), and `retention` and `tuvl.memory_compact` keep it small.
    [Engines](internals/engines.md#remembering-across-runs-llmmemory-loopmemory), [Memory in Insight](insight/memory.md)

-   **A Memory page and a parallel step in Insight**

    ---

    Browse what agents remember, per collection and owner, and forget one memory or one person. The canvas has a
    **Run lookups in parallel** preset, and the run timeline names each branch with its time.
    [Insight](internals/insight.md)

-   **Skills for what b8 and b9 added**

    ---

    The coding-agent skill set now covers triggers, file uploads, webhooks and per-signal outputs (`tuvl-workflow`), the
    collection tool, and the new streaming, parallel and memory features. `tuvl update skills` adds them to a project.

</div>

## New in 2.0.0b9

<div class="grid cards" markdown>

-   **Collections in workflows**

    ---

    A `loop` agent can search a collection as a tool (`- collection: kb_docs`): the model supplies the query, and `top_k` and
    the filter are fixed in the YAML. In Insight the vector search and ingest steps pick their collection from the configured ones,
    and a **Retrieve and answer** step adds a search routed into an answering model that cites its sources.
    [Loop and tools](internals/loop-and-tools.md), [Embeddings & Collections](insight/embeddings-collections.md)

-   **A better agent panel in Insight**

    ---

    An `llm` or `loop` agent picks its AI model from the configured presets, takes its prompt, steering, skills, MCP servers and
    judge from stored artifacts pinned to a version, and the whole agent can be edited as YAML. [Insight](internals/insight.md)

-   **Ideas from Insight**

    ---

    Upload an idea (files, a folder or text) on the Ideas page and **generate a spec** from it with your coding agent, after
    asking for consent. [Authoring](internals/authoring.md)

-   **Provenance on PyPI**

    ---

    `tuvl` and `tuvl-insight` are published with PEP 740 attestations again, and the release fails if PyPI has none for any file.

</div>

## New in 2.0.0b8

<div class="grid cards" markdown>

-   **Commands are actions: `tuvl <verb> <thing>`**

    ---

    The pipeline reads in order: `init`, `import idea`, `generate spec`, `approve spec`, `generate tasks`,
    `generate code`, `verify spec`, `run tests`, `ship`. Each verb makes one promise: `generate` writes files,
    `lint` runs static rules, `verify` checks that two things are in step, `check` asks whether something works
    now, `list` and `show` only read. The earlier names are gone; run `tuvl generate code` once after upgrading.
    [Command reference](internals/cli.md)

-   **Specs and tasks in Insight and the terminal UI**

    ---

    Approve, send back, reopen and derive tasks from Insight or the terminal UI. A task opens in a panel you
    can drag and pop out, with what it builds, what it waits for and the spec section it came from. **Graph**
    draws the tasks as a tree in execution order. A blocked task says why; a failed run keeps a report of
    every attempt. `tuvl show task` prints the same. [Insight](internals/insight.md)

-   **Webhooks and file uploads**

    ---

    A workflow can send a signed notification when a run completes, fails or waits for a person, and a trigger
    can accept `multipart/form-data` and pass the run a reference, never the bytes.
    [Webhooks](internals/webhooks.md), [API](internals/api.md)

-   **Production server and keys**

    ---

    `tuvl serve app` shuts down cleanly behind an ingress and exposes only the route groups you choose
    (`spec.api.expose`). `TUVL_SIGNING_KEY` is the only name for the signing key; the 1.x
    `TUVL_BISCUIT_PRIVATE_KEY` is no longer read. [Authentication](internals/auth.md)

-   **Nest: the public catalogue**

    ---

    Applications built with tuvl can be listed at [nest.tuvl.io](https://nest.tuvl.io). `tuvl register project` shows the exact
    payload first and asks; sign-in is GitHub's device flow. Run your own with `--nest URL` or `TUVL_NEST_URL`.
    [Project and catalogue](internals/project.md)

-   **Tools: Laya Serve and Flightlog**

    ---

    A new [Tools](tools/index.md) section. **Laya Serve** is the container image of the Laya decision model that `decide` agents can
    use. **Flightlog** is the collector for developer telemetry, as a small Python service and as a tuvl project.

-   **Developer telemetry (optional)**

    ---

    Share what developers do on a project through a collector your team runs, and see what the others did in Insight and with
    `tuvl list team-activity`. A token per developer, initials from registration, token rotation, and a private certificate authority.
    [Developer telemetry](internals/dev-telemetry.md)

-   **Failures and branches in Insight**

    ---

    A failed task keeps a report of what was tried and why it failed. Tasks are drawn as a graph, and a tree of branches shows
    parallel work, commits and what should merge first. Long jobs started from Insight survive a reload.
    [Insight](internals/insight.md)

</div>

## Highlights

<div class="grid cards" markdown>

-   **Authoring with your coding agent, acceptance without one**

    ---

    `tuvl init` finds the agents you have; `tuvl import idea` numbers an idea, `generate spec` has your agent
    draft the spec on a branch, a person approves it, `generate tasks` derives the tasks, and `generate code --spec`
    builds each task on its own pull request. Every step is in a local audit ledger, and `tuvl dev` shows
    the path in a terminal UI. [Authoring](internals/authoring.md)

-   **Typed agents, nine engines**

    ---

    `code`, `tool` (db / http / storage / mcp), `decide`, `llm`, `loop`, `map`, `parallel`, `human`, `pending` — one
    contract (`inputs`, `outputs`, signals) for all of them. Named ends replace `Response` steps.
    [Engines](internals/engines.md)

-   **Checked before it runs**

    ---

    `tuvl lint project` checks contracts, data flow, types and policy (V001–V036) and prints each
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

    The coding agent builds; tuvl referees. `tuvl lint spec` checks the spec, `tuvl verify spec`
    checks the build against it, and task status is derived, never self-reported. `tuvl generate code`,
    `tuvl run tests` and `tuvl generate lock` are deterministic; `tuvl serve mcp` and 14 skills for coding agents.
    [Spec-driven development](internals/spec-driven.md)

-   **Fan-out with `map`**

    ---

    `engine: map` runs a child workflow once for every item of a list, a few at a time. Each item is
    a run of its own with its own journal, a crashed parent follows the children it already
    started, and `on_error: collect` keeps going and routes `partial`. `tuvl lint project` prices it at
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
    with `tuvl set project` or in Insight, and list the project on [nest.tuvl.io](https://nest.tuvl.io)
    with `tuvl register project` or the Register button. [Project and Catalogue](internals/project.md)

-   **Verb-first commands**

    ---

    Commands read as `tuvl <verb> <noun>`: `tuvl generate code`, `tuvl list specs`, `tuvl verify spec`,
    `tuvl set project`, `tuvl review code`, `tuvl serve app`. The server shuts down cleanly
    on a stop signal. [CLI reference](internals/cli.md)

-   **Schedules, uploads and webhooks**

    ---

    API and schedule triggers are switchable and a scheduled run carries its input
    (`trigger.schedule: { cron, enabled, input }`, validated as V019). The `file` type and
    `http.upload` take multipart uploads (V037). `spec.webhooks` sends signed, minimal
    notifications when a run ends. [Webhooks](internals/webhooks.md) · [API](internals/api.md)

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
| `Functional` + `@node` | `code` agent + `@agent`, typed `In`/`Out` from `tuvl generate code` |
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
