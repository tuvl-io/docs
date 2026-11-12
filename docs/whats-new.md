# What's new in 2.0

tuvl **2.0.0** is a redesign: workflows are graphs of typed **agents**, every run is **durable and
journaled**, and projects are built **spec-first**. The full list of changes is in the
[changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

!!! info "License: Apache 2.0"
    tuvl is licensed under the **Apache License, Version 2.0**, which includes an express patent grant.
    Using, modifying and selling software built on tuvl is free. [The license](license.md)

## New in 2.1.0 (beta)

**Production IAM, an environment manifest, and a thinner engine.** 2.1.0 is in beta (`2.1.0b3`): install it by pinning both packages (not with `--prerelease allow`, which lets every dependency go to a pre-release):
`uv tool install "tuvl==2.1.0b3" --with "tuvl-insight==2.1.0b3"`. Nothing in your YAML changes.

- **`tuvl iam` manages users, roles and scopes inside the deployment.** `kubectl exec -it deploy/<app> -- tuvl iam roles list`:
  the administrator signs in and the command works on the database directly. Roles can be disabled, the last administrator
  cannot be removed, and `reset-admin` is the break-glass. [Production IAM](internals/auth.md#production-iam)
- **Roles and the first administrator are seeded once.** A `kind: RoleSeed` document and `TUVL_BOOTSTRAP_ADMIN_EMAIL` /
  `_PASSWORD` create them on the first boot of an empty database, under an advisory lock, and never touch a database that
  already has users.
- **`kind: EnvConfig` declares the environment a project needs.** Variables get a description, `secret`, `required` and a
  `default`; `tuvl lint project` checks them, `tuvl ship` writes the Secret list, the chart values and `.env.example` from
  them, a production server refuses to start without a required one, and Insight has a **Settings → Environment** page.
  [Environment variables](internals/environment.md)
- **`tuvl deploy` deploys to a tuvl cloud (2.1.0b3).** It packages the project, uploads it with a client token and follows the build
  and the deployment. `--check-dns` tells whether a name is free and points at the cloud, `--set-hostname` renames the deployed app,
  and `--admin-email` creates the app's administrator with a password made on your machine. [Deploy to a tuvl cloud](getting-started/shipping.md#tuvl-deploy-deploy-to-a-tuvl-cloud)
- **`tuvl` is the engine; the developer tooling is in `tuvl-insight`.** The production wheel has 160 modules instead of 264.
  `tuvl[standard]` installs both, and it is still one `tuvl` command: on a bare install the development commands answer with how
  to install them. [Core and Insight](internals/core-and-insight.md)

**Before you upgrade a production setup:** the REST IAM admin routes (`/auth/bootstrap`, `/auth/admin/*`) are no longer mounted
in production by default (use `tuvl iam`, or add `iam` to `spec.api.expose`); the extras `tuvl[codegen]`, `[test]`, `[tui]`,
`[review]` and `[pdf]` are gone (use `tuvl[standard]`); and tuvl's Python modules for the tooling moved to `tuvl_insight`.

The full list is in the [changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

## New in 2.0.3

A security patch release. Only dependencies change; nothing here changes how an existing project runs.

- **Patched Python dependencies.** `PyJWT`, `starlette`, `python-multipart`, `mcp`, `cryptography`, `pypdf`, `anyio`,
  `certifi`, `idna`, `opentelemetry-api` and `pydantic-settings` move to releases that fix their published advisories.
  tuvl signs and verifies its tokens with local EdDSA keys only, so most `PyJWT` advisories (key sets, PEM handling) did not
  reach it; the form-parsing ones reach the upload endpoints, and the `mcp` ones reach `/mcp` when the export is on.
- **Higher minimum versions.** `PyJWT[crypto]>=2.15.0`, `starlette>=1.3.1`, `python-multipart>=0.0.31`, `mcp>=1.30.0`
  (extra `mcp`) and `pypdf>=6.21.4` (extra `pdf`), so an install that resolves to the lowest allowed version is no longer
  vulnerable. Upgrade with `uv tool upgrade tuvl`, or `pip install -U "tuvl[standard]"`.
- **The Insight UI's dependencies are updated** (`vite`, `react-router-dom`, `js-yaml`, `minimatch` and others). Its typecheck,
  lint, unit tests and browser smoke tests pass on the new versions.

The full list is in the [changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

## New in 2.0.2

A patch release. Nothing here changes how an existing project runs.

- **`tuvl` starts on Windows.** Every command failed at import with `No module named 'fcntl'`. The telemetry outbox locks now
  work on Windows, commands started from Insight run there too, and CI installs the wheel and starts the CLI on Windows.
- **Gemini loop agents keep their tool-call signatures.** Gemini 3 returns an opaque `thought_signature` with each tool call
  and rejects the next request if it is missing. tuvl now keeps it and sends it back, in streaming and non-streaming calls.
- **A `note:` line under a spec step.** `- note: <text>` is free text no check reads, for saying why a step is built the way it
  is. When a step line does not parse, the error now lists the lines a step takes.
  [Spec-driven development](internals/spec-driven.md)
- **The spec checker follows what the engine builds.** `tool storage` and `tool http` steps can route the signals they emit
  (`not_found`, `http_404`), an optional trigger input written `` `x`? (str) `` is kept, and an `Input:` field that does not
  parse is reported instead of dropped.
- **`llm.memory.retention` no longer breaks `tuvl run tests`.** The retention sweep did nothing useful on the offline SQLite
  test database and crashed; it now skips it.
- **The `agent-code` skill lists the effects the schema accepts:** `read`, `write` and `destructive` (default `write`).

The full list is in the [changelog](https://github.com/tuvl-io/tuvl/blob/main/CHANGELOG.md).

## New in 2.0.1

A patch release: a token's `iat` is never ahead of the clock, the first memory-retention and draft sweeps no longer wait for
the machine to have been up, and `tuvl-insight` has a project description on PyPI. Releases are published from the public
repository with provenance.

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
    (`spec.api.expose`). `TUVL_SIGNING_KEY` is the only name for the signing key. [Authentication](internals/auth.md)

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

The [examples](examples/example-projects.md) show every pattern on 2.0.
