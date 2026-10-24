# Build a project: from init to ship

This guide builds one small project from an empty folder to a container image, twice over: **with a
coding agent** and **by hand**. The two tracks end with the same files and the same checks, because
in both of them **tuvl is the referee**. It checks every step without calling a model, so it costs
nothing, and it tells you what is left.

You will build **refund approvals**. A customer asks for a refund on an order. A refund of 100 or
less is recorded straight away. A larger one waits for a finance lead, who approves or rejects it.
The workflow uses no language model, so every check in this guide is offline and free.

!!! info "What you need"
    - tuvl installed ([Installation](installation.md)); during the beta, `uv tool install --prerelease allow "tuvl[standard]"`.
    - PostgreSQL, only for [Run it](#8-run-it). Everything before that is offline.
    - Docker, only if you build the image in [Ship it](#10-ship-it). Writing the Dockerfile and chart needs none.
    - For the agent track: a coding agent that reads `AGENTS.md` (Claude Code, Cursor, Codex, Kiro, ...).

## The map

| # | Stage | What happens | Main command |
|---|---|---|---|
| 1 | [Create](#1-create-the-project) | A project folder with config, skills and rules | `tuvl init` |
| 2 | [Spec](#2-write-the-spec) | Intent, data, flow and examples, in one Markdown file | `tuvl lint spec` |
| 3 | [Data](#3-data-models) | The models the spec names | `tuvl lint project` |
| 4 | [Workflow](#4-the-workflow) | The graph of agents | `tuvl lint project --strict` |
| 5 | [Tasks](#5-the-task-list) | One task per model, step and example | `tuvl list tasks` |
| 6 | [Generate and lock](#6-generate-and-lock) | Schemas, tests from the examples, the lock | `tuvl generate code`, `tuvl generate lock` |
| 7 | [The gate](#7-the-gate) | Seven checks that must all pass | see below |
| 8 | [Run](#8-run-it) | The server, a real request, a real approval | `tuvl dev` |
| 9 | [Change](#9-change-it-later) | A spec change flows through the checks | `tuvl show drift` |
| 10 | [Ship](#10-ship-it) | Dockerfile, Helm chart, image | `tuvl ship` |

!!! tip "Who does what"
    **The coding agent builds; tuvl referees.** In the agent track you write the intent and review
    the result, and the agent does stages 2 to 6 by running tuvl's commands until they are green. In
    the manual track you do those stages yourself. Every tab below shows both. Stages 7 to 10 are the
    same either way.

!!! tip "Prefer to start from an idea?"
    This guide writes the spec by hand. If you have a brief (Markdown, PDF or Word) and a coding agent
    installed, `tuvl import idea brief.pdf` → `tuvl generate spec` → `tuvl approve spec` → `tuvl generate tasks` →
    `tuvl generate code --spec …` does stages 2 to 6 with your agent, one pull request per task, and the same gate
    at the end. See [Authoring with a coding agent](../internals/authoring.md).

## 1. Create the project

```bash
tuvl init refunds -y --preset ollama
cd refunds
```

`-y` accepts every default. `--preset` writes `llms/default.yaml` for the provider you will use
later (`gemini`, `openai`, `anthropic` or `ollama`); this project calls no model, so any preset
works. Leave out `--sample`: that flag adds a ready-made triage example, and here you build your own.

```text
refunds/
├── AGENTS.md, CLAUDE.md       rules for coding agents (CLAUDE.md just points at AGENTS.md)
├── .agents/skills/            14 skills for coding agents (mirrored to .claude/skills/)
├── pyproject.toml             your Python dependencies (uv)
├── .env, .env.example         secrets and connection settings (.env is git-ignored)
├── .tuvl/                     project identity (project.yaml) and system settings
├── datasources/postgres.yaml  the database connection, read from .env
├── llms/default.yaml          the model preset
├── models/  workflows/  agents/  artifacts/  federation/     empty, you fill them
└── README.md
```

=== "With a coding agent"

    `init` already gave the agent everything it needs: `AGENTS.md` holds the non-negotiable rules
    (never infer project state, never hand-edit generated files, finish every change green), and
    the skills in `.agents/skills/` teach it each stage: `tuvl-spec`, `tuvl-plan`,
    `tuvl-task-loop`, one skill per engine (`agent-code`, `agent-tool`, `agent-llm`, `agent-loop`,
    `agent-decide`, `agent-human`, `agent-map`), `tuvl-data`, `tuvl-test`, `tuvl-harden` and
    `tuvl-ship`.

    Give the agent tuvl's own tools by adding the development MCP server to the agent's config:

    ```json title=".mcp.json"
    { "mcpServers": { "tuvl": { "command": "tuvl", "args": ["mcp", "-d", "."] } } }
    ```

    It offers `validate`, `spec_check`, `spec_verify`, `spec_status`, `spec_diff`, `get_contract`,
    `list_agents`, `explain_error`, `codegen` and `test`, all read-only. Add `--allow-write` to also
    allow `codegen_write`, `run_workflow` and `pin_fixture`. Without MCP the agent runs the same
    commands in a shell with `--json`.

    After you upgrade tuvl, `tuvl update skills --diff` shows what would change in the skills and
    `tuvl update skills` applies it.

=== "By hand"

    Nothing more to set up. If you do not use a coding agent, `tuvl init --no-ai-skills` skips the
    `.agents/` directory (the agent rules and skills).

## 2. Write the spec

The spec is the one document that says what the project is for. `tuvl create spec` writes a template
that already passes the check:

```bash
tuvl create spec refund-request
```

A spec is Markdown. `# Intent` and `# Policies` are prose for people and the agent. Three parts are
**structured**, and tuvl checks them: `# Data` (the models), `# Flows` (the steps, routes and ends)
and the `tuvl-example` blocks under `# Acceptance` (each one becomes a test). The grammar is in
[Spec-driven development](../internals/spec-driven.md#1-write-the-spec).

=== "With a coding agent"

    You decide *what*; the agent writes the structured parts with the `tuvl-spec` skill. Give it the
    intent in plain words and ask for the spec only:

    > Use the tuvl-spec skill. Write `specs/refund-request.md` for this: customers request a refund
    > on an order (`order_id`, `amount`, `reason`). If the amount is 100 or less, record it. If it
    > is more, a finance lead (group `finance_lead`, 24 hours) must approve first; rejected or
    > expired means no refund. An unknown order is a 404. Include an example for every end. Do not
    > build anything yet. Run `tuvl lint spec` until it has no blocking findings, then show me.

    **Review it before anything is built.** This is the cheapest place to catch a wrong idea:

    - Does every end have the right HTTP status, and an example (`tuvl lint spec` warns with S011 if not)?
    - Who is allowed to call the flow, and who may approve (S010, S013)?
    - Is the threshold the one you meant, and is it in `# Policies` too?
    - Is every model marked `(new)` or `(existing)` correctly?

=== "By hand"

    Replace the template with the spec below. It is the whole project in one file.

    ??? example "specs/refund-request.md"

        ~~~markdown
        ---
        name: refund-request
        owner: payments-team
        workflow: refund_request
        ---
        # Intent
        Customers ask for a refund on an order. A small refund is recorded straight away; a larger one waits
        for a finance lead, who approves or rejects it.

        # Data
        - **Order** (existing) — `id` (uuid), `total` (numeric; required)
        - **Refund** (new) — `order_id` (uuid → Order; required), `amount` (numeric; required),
          `reason` (text), `status` (enum: recorded | approved; required; default recorded)

        # Flows

        ## Flow: refund_request
        Trigger: POST /api/refunds · signed-in
        Input: `order_id` (uuid), `amount` (float), `reason` (str)
        Ends: default 201 · unknown_order 404 · rejected 200 · failed 500
           - failed: no example — a create on a new row has no conflict to provoke

        1. `load_order` — tool db read Order · in `order_id` · out `order` (Order)
           - not_found → END.unknown_order
        2. `check_amount` — decide rules · in `amount` · out `lane` (enum[auto, review])
           - `amount <= 100` → auto
           - otherwise → review
           - auto → `record_refund`
           - review → `finance_review`
        3. `finance_review` — human group finance_lead · expires 24h · in `amount` · out `approved` (bool)
           - true → `record_refund`
           - false, expired → END.rejected
        4. `record_refund` — tool db create Refund · in `order_id`, `amount`, `reason` · out `refund` (Refund)
           - conflict → END.failed

        # Policies
        A refund above 100 is never recorded without a finance lead's approval.

        # Acceptance
        ```tuvl-example
        name: a small refund is recorded
        given: { Order: [{ id: "6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10", total: 120 }] }
        input: { order_id: "6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10", amount: 40, reason: "Arrived broken." }
        expect: { end: default, path: [load_order, check_amount, record_refund] }
        ```
        ```tuvl-example
        name: an unknown order is refused
        input: { order_id: "11111111-2222-4333-8444-555555555555", amount: 40, reason: "No such order." }
        expect: { end: unknown_order, path: [load_order] }
        ```
        ```tuvl-example
        name: a large refund waits for a finance lead
        given: { Order: [{ id: "6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10", total: 900 }] }
        input: { order_id: "6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10", amount: 400, reason: "Wrong size." }
        expect: { end_or_wait: human, path_includes: [check_amount] }
        ```
        ```tuvl-example
        name: a finance lead rejects a large refund
        given: { Order: [{ id: "6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10", total: 900 }] }
        input: { order_id: "6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10", amount: 400, reason: "Wrong size." }
        mocks:
          finance_review: { signal: "false", outputs: { approved: false } }
        expect: { end: rejected, path: [load_order, check_amount, finance_review] }
        ```
        ~~~

    Reading the flow: each numbered line is a step (`id`, engine, inputs `in`, outputs `out`), and the
    indented lines are routes. `tool db read Order` loads the order and routes `not_found` to the
    end `unknown_order`. `decide rules` picks a lane from the amount. `human group finance_lead`
    waits for a person. `tool db create Refund` stores the result. `failed: no example` is a waiver:
    the spec says on purpose that this end has no example, and a reviewer can see why.

Now check it. Nothing is built yet, so the spec is allowed to be ahead of the project:

```bash
tuvl lint spec
```

```text
specs/refund-request.md
  ✗ S007   :11   Order is marked (existing) but is not in models/
  · WAIVED :21   flow refund_request: end `failed` has no example — a create on
a new row has no conflict to provoke
```

`✗` is blocking and `!` is a warning. S007 is the next thing to do: the spec says `Order` already
exists, so tuvl expects `models/order.yaml`. Every finding names a line and a rule; the full list
(S001 to S021) is in the [spec reference](../internals/spec-driven.md#2-check-it).

## 3. Data models

=== "With a coding agent"

    Ask for the models with the `tuvl-data` skill: *"Create the models from `# Data` in the spec."* It
    writes one `ModelDefinition` per model and runs `tuvl lint spec` until S007 is gone.

=== "By hand"

    `Order` is an existing table that the flow only reads. `Refund` is new.

    ```yaml title="models/order.yaml"
    kind: ModelDefinition
    version: v1
    metadata:
      name: Order
      schema_version: v1
      description: A customer order. Already in the database; the refund flow only reads it.
    spec:
      tablename: orders
      fields:
        - name: id
          type: uuid
          primary_key: true
        - name: total
          type: numeric
          required: true
    ```

    ```yaml title="models/refund.yaml"
    kind: ModelDefinition
    version: v1
    metadata:
      name: Refund
      schema_version: v1
      description: A refund recorded against an order.
    spec:
      tablename: refunds
      api:
        crud: [list, read]
      fields:
        - name: id
          type: uuid
          primary_key: true
          input: false
        - name: order_id
          type: uuid
          required: true
        - name: amount
          type: numeric
          required: true
        - name: reason
          type: text
        - name: status
          type: enum
          enum_values: [recorded, approved]
          default: recorded
          required: true
        - name: created_at
          type: timestamptz
          input: false
    ```

    A few things worth knowing: `input: false` keeps a server-generated field out of the create
    schema, `enum_values` plus `default` give the status its starting value, and
    `api: crud: [list, read]` exposes read-only routes for refunds (writes go through the workflow).
    The model YAML has no foreign-key option, so `uuid → Order` in the spec is checked against a
    plain `uuid` field.

```bash
tuvl lint spec          # S007 is gone
```

## 4. The workflow

A workflow is a graph of **agents**. Each agent has a typed contract (`inputs`, `outputs`, the signals
it can emit) and an **engine** that does the work. Routes connect signals to the next agent or to a
named end, and there are no implicit edges.

| Agent | Engine | What it does |
|---|---|---|
| `load_order` | `tool` (db read) | Loads the order; `not_found` ends as `unknown_order` (404) |
| `check_amount` | `decide` (rules) | `amount <= 100` is `auto`, anything else is `review` |
| `finance_review` | `human` | Waits for a person in `finance_lead`; `false` or `expired` ends as `rejected` |
| `record_refund` | `tool` (db create) | Writes the refund; a `conflict` ends as `failed` |

=== "With a coding agent"

    The agent builds the workflow with the `tuvl-task-loop` skill, one task at a time, and picks the
    engine skill for each step (`agent-tool`, `agent-decide`, `agent-human`). The loop it follows is
    the same one you would:

    1. `tuvl list tasks --json` says which task is next and why others are blocked.
    2. Build what the task targets, exactly as the spec line says.
    3. `tuvl generate code` after any contract change.
    4. `tuvl lint project --json` and `tuvl verify spec --json`; fix every error.
    5. `tuvl run tests --json` until a passing test goes through the step.
    6. Repeat until `tuvl list tasks --strict` exits 0.

    A step it cannot finish stays `pending` (a contract with no implementation) instead of being
    faked. Only a `code` agent needs Python, and then only the function body.

    **Review the diff.** Compare `workflows/refund_request.yaml` with the spec line by line. `tuvl
    spec verify` does the same comparison for you (stage 7), but a person should still read it once.

=== "By hand"

    ??? example "workflows/refund_request.yaml"

        ```yaml
        kind: Workflow
        version: tuvl/v2
        metadata:
          name: refund_request
          description: Record a refund; a large one waits for a finance lead.
        spec:
          models: [Order, Refund]
          trigger:
            http: { path: /api/refunds, method: POST }
            input:
              order_id: uuid
              amount: float
              reason: str

          agents:
            - id: load_order
              description: Load the order being refunded
              engine: tool
              inputs: { order_id: uuid }
              outputs: { order: Order }
              tool:
                use: db
                model: Order
                op: read
                where: { id: "{{ order_id }}" }
              routes:
                default: check_amount
                not_found: END.unknown_order
                error: END.failed

            - id: check_amount
              description: A refund of 100 or less is recorded straight away; a larger one needs a lead
              engine: decide
              inputs: { amount: float }
              outputs: { lane: "enum[auto, review]" }
              decide:
                rules:
                  - { when: "amount <= 100", then: auto }
                  - { when: "true", then: review }
              routes:
                auto: record_refund
                review: finance_review
                error: END.failed

            - id: finance_review
              description: A finance lead approves or rejects a large refund
              engine: human
              inputs: { amount: float }
              outputs: { approved: bool }
              human:
                title: "Refund of {{ amount }}"
                instruction: Approve to record this refund.
                show: [amount]
                required_group: finance_lead
                expires: 24h
                route_on: approved
              routes:
                "true": record_refund
                "false": END.rejected
                expired: END.rejected
                error: END.failed

            - id: record_refund
              description: Record the refund
              engine: tool
              inputs: { order_id: uuid, amount: float, reason: str }
              outputs: { refund: Refund }
              tool:
                use: db
                model: Refund
                op: create
                values:
                  order_id: "{{ order_id }}"
                  amount: "{{ amount }}"
                  reason: "{{ reason }}"
              routes:
                default: END
                conflict: END.failed
                error: END.failed

          outputs:
            default:
              status: 201
              body: { id: "{{ refund.id }}", amount: "{{ refund.amount }}", status: "{{ refund.status }}" }
            unknown_order:
              status: 404
              body: { error: no such order }
            rejected:
              status: 200
              body: { status: rejected }
            failed:
              status: 500
              body: { error: the refund could not be recorded }
        ```

    Points to notice:

    - `routes` lists every signal an agent can emit. `tuvl lint project` rejects a missing route, so a
      path you forgot is an error, not a surprise at run time.
    - `decide` rules are `{ when, then }`, first match wins, and the last rule is `when: "true"`.
    - `human` has `required_group`, an `expires`, and `route_on: approved`, which turns the
      boolean answer into the routes `"true"` and `"false"` (quoted, they are YAML strings).
    - `outputs` maps each end to a status and a body. `default` is the success end.

```bash
tuvl lint project --strict
```

```text
Models detected:  2  Order, Refund
Code agents:      none
Errors:           0
Warnings:         0
  refund_request  4 agents · 3 deterministic · 1 external · worst-case 0 tok
  needs models: none — no LLM or decision model required
✓ Validation passed — project looks good!
```

The summary line is the **determinism profile**: three agents are deterministic, one waits for a
person (external), and the worst-case token cost is 0 because no model is involved. When you add an
`llm` step later, this line grows a token budget you set.

!!! warning "A typo is caught here, not in production"
    Writing a decide rule as `- when: "amount <= 100"` with `value: auto` (instead of `then: auto`)
    fails with `[V001] spec.agents[check_amount].decide.rules[0].then: Field required`. Every
    error carries a code; `tuvl lint project` lists them all, and the agent's `explain_error` tool
    explains one.

## 5. The task list

The task list is how tuvl measures progress. It has one task per **new model**, per **step** and per
**example**, plus a `manual` task for anything only a person can do (credentials for an HTTP or MCP
step). tuvl never plans with a model, and it never lets anyone set a status: **a task's status is
derived** from the project.

| Status | Means |
|---|---|
| `todo` | Not built yet (a `pending` agent, a missing file, an example with no test) |
| `in_progress` | Built, but `lint project` or `verify spec` reports a problem |
| `implemented` | Validates cleanly and matches the spec |
| `tested` | A passing test covers it |
| `done` | Nothing blocks shipping |

=== "With a coding agent"

    The agent writes `specs/refund-request.tasks.yaml` with the `tuvl-plan` skill, after the spec has no
    blocking findings. Check its work: every model, step and example should have a task, and no task
    carries an estimate or a hand-set status (P004).

=== "By hand"

    The only values you cannot invent are the **hashes**. They tie a task to the exact version of the
    spec section it came from, and tuvl prints them:

    ```bash
    tuvl lint spec --json | jq -r '.specs[0].hash'                       # the spec's hash
    tuvl lint spec --json | jq -r '.specs[0].sections[] | "\(.anchor) \(.hash)"'
    ```

    ```text
    intent 7ac196eddd46
    data 38fe48d961df
    flows 7d14b7826850
    flow-refund-request d4288ac72c9b
    policies 45985c2e44d8
    acceptance d955f6a357cf
    ```

    Put the spec hash in `metadata.spec_hash`, and each task's section anchor and hash in its
    `spec_ref`. The file has nine tasks: the `Refund` model (`Order` is existing, so it needs no task),
    the four steps and the four examples.

    ??? example "specs/refund-request.tasks.yaml"

        ```yaml
        kind: TaskPlan
        version: tuvl/v2
        metadata: { name: refund-request, spec: specs/refund-request.md, spec_hash: f010f2617b63 }
        spec:
          tasks:
            - id: T1
              title: Refund model
              type: model
              spec_ref: { anchor: data, hash: 38fe48d961df }
              target: { model: Refund }
            - id: T2
              title: Load the order (tool db read)
              type: agent
              spec_ref: { anchor: flow-refund-request, hash: d4288ac72c9b }
              target: { workflow: refund_request, agent: load_order }
              depends_on: [T1]
            - id: T3
              title: Route by amount (decide rules)
              type: agent
              spec_ref: { anchor: flow-refund-request, hash: d4288ac72c9b }
              target: { workflow: refund_request, agent: check_amount }
              depends_on: [T2]
            - id: T4
              title: Finance lead review (human)
              type: agent
              spec_ref: { anchor: flow-refund-request, hash: d4288ac72c9b }
              target: { workflow: refund_request, agent: finance_review }
              depends_on: [T3]
            - id: T5
              title: Record the refund (tool db create)
              type: agent
              spec_ref: { anchor: flow-refund-request, hash: d4288ac72c9b }
              target: { workflow: refund_request, agent: record_refund }
              depends_on: [T1, T3, T4]
            - id: T6
              title: "Example: a small refund is recorded"
              type: test
              spec_ref: { anchor: acceptance, hash: d955f6a357cf }
              target: { workflow: refund_request, example: a small refund is recorded }
              depends_on: [T5]
            - id: T7
              title: "Example: an unknown order is refused"
              type: test
              spec_ref: { anchor: acceptance, hash: d955f6a357cf }
              target: { workflow: refund_request, example: an unknown order is refused }
              depends_on: [T2]
            - id: T8
              title: "Example: a large refund waits for a finance lead"
              type: test
              spec_ref: { anchor: acceptance, hash: d955f6a357cf }
              target: { workflow: refund_request, example: a large refund waits for a finance lead }
              depends_on: [T4]
            - id: T9
              title: "Example: a finance lead rejects a large refund"
              type: test
              spec_ref: { anchor: acceptance, hash: d955f6a357cf }
              target: { workflow: refund_request, example: a finance lead rejects a large refund }
              depends_on: [T4]
        ```

    `depends_on` orders the work (the model before the steps that use it, an example after the steps
    it runs through). The hashes come from the exact text of the spec: if you type the spec above
    unchanged, the task list passes as printed, and any edit to a section changes its hash (and is
    reported as P005 until you refresh it, as in [stage 9](#9-change-it-later)).

Look at the board:

```bash
tuvl list tasks
```

Before the tests exist it shows exactly what is missing and why, for example:

```text
  T1   implemented Refund model
        tuvl.lock is missing
  T2   implemented blocked Load the order (tool db read)
        no passing Test covers refund_request.load_order
        waiting on T1
  T6   todo        blocked Example: a small refund is recorded
        no generated test for example 'a small refund is recorded' — run tuvl generate code
        waiting on T5
```

The reasons are the to-do list. The next stage clears them.

## 6. Generate and lock

```bash
tuvl generate code
tuvl generate lock
```

```text
+ agents/_generated/schemas.py
+ tests/refund_request/a-small-refund-is-recorded.yaml
+ tests/refund_request/an-unknown-order-is-refused.yaml
+ tests/refund_request/a-large-refund-waits-for-a-finance-lead.yaml
+ tests/refund_request/a-finance-lead-rejects-a-large-refund.yaml
5 file(s) written.
wrote tuvl.lock: 0 model(s), 0 artifact(s), 0 judge(s), 0 MCP tool(s)
```

`tuvl generate code` writes what follows mechanically from your YAML and spec: typed schemas for every agent
(`agents/_generated/schemas.py`), and **one test per `tuvl-example`** in the spec. It never writes a
function body. If the project had a `code` agent it would also write its stub and keep your code
on every later run ([Code generation](codegen.md)). Never edit generated files; change the spec and
run it again.

`tuvl generate lock` writes `tuvl.lock`: the tuvl version and, when you have them, the exact model ids,
prompt hashes and MCP tool schemas the project depends on. It is empty of those here, and it still
matters: `tuvl ship` refuses a stale lock (V024), so a model upgrade can never reach production by
accident. Commit it.

## 7. The gate

Seven commands decide whether the project is consistent. Run them together; this is also your CI:

```bash
tuvl lint spec && tuvl lint project --strict && tuvl generate code --check && tuvl verify lock \
  && tuvl run tests --strict && tuvl verify spec --strict && tuvl list tasks --strict
```

| Command | It proves |
|---|---|
| `tuvl lint spec` | The spec is complete and consistent (S001 to S016) and the task list matches it (P001 to P005) |
| `tuvl lint project --strict` | The workflows are well-formed: routes, types, data flow, policy (V001 to V036). `--strict` makes warnings fail |
| `tuvl generate code --check` | Generated files are up to date; exits 1 if anything would change |
| `tuvl verify lock` | `tuvl.lock` matches the project |
| `tuvl run tests --strict` | The tests pass; `--strict` also fails a result that only passed through unimplemented steps |
| `tuvl verify spec --strict` | The workflow matches the spec step by step (R001 to R010) |
| `tuvl list tasks --strict` | Every task is `done` |

```text
$ tuvl run tests --strict
PASS    a-finance-lead-rejects-a-large-refund (refund_request → END.rejected, 0 tok)
PASS    a-large-refund-waits-for-a-finance-lead (refund_request → END.?, 0 tok)
PASS    a-small-refund-is-recorded (refund_request → END.default, 0 tok)
PASS    an-unknown-order-is-refused (refund_request → END.unknown_order, 0 tok)
4 passed · 0 stubbed (not counted) · 0 failed

$ tuvl verify spec --strict
  refund_request
    load_order             tool db read Order           :23   ✓ 4 passed
    check_amount           decide rules                 :25   ✓ 3 passed
    finance_review         human group finance_lead     :30   ✓ mocked in 1
    record_refund          tool db create Refund        :33   ✓ 1 passed
  0 mismatch(es) · steps implemented 4/4 · exercised by real tests 3/4

$ tuvl list tasks --strict
  T1   done        Refund model
  ...
  T9   done        Example: a finance lead rejects a large refund
tests 4/4 passing · tuvl.lock current
```

Two details are worth understanding:

- **Tests run offline** against an in-memory database. They mock only what is non-deterministic,
  external or human. Here that is the `finance_review` step, because nobody answers a form in a test.
  Business logic (`tool db`, `decide` rules, `code`) runs for real, and the order is seeded with
  `given:` in the example. That is why `verify spec` says `3/4` are exercised by real tests: the
  fourth is mocked on purpose.
- **A mock cannot hide a gap.** If a step is still `pending`, a test that passes through it is
  reported `STUBBED`, does not count, and fails `--strict`.

=== "With a coding agent"

    The agent runs this gate after every change and does not stop until it is green. Run it
    yourself once at the end; that is your acceptance test of the agent's work.

=== "By hand"

    If a command fails, its output names the rule and the line. Fix that, and rerun the gate.
    The [troubleshooting table](#troubleshooting) lists the messages you are most likely to meet.

## 8. Run it

So far nothing needed a database. To call the workflow you need PostgreSQL. Create a database and
point `.env` at it:

```bash
createdb refunds
```

```bash title=".env"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=refunds
POSTGRES_USER=postgres
POSTGRES_PASSWORD=...
```

Start the engine in dev mode:

```bash
tuvl dev --show-key
```

It prints a **security key** and the address of Insight, the browser UI (`http://localhost:8885/insight/`).
In dev mode the key works as an admin bearer token. Insight shows the workflow as a graph, runs it
with **Run**, and lists approvals under **Runs**. On startup tuvl creates the tables for your
models; the `Order` table stands in for the one your system already has, so add an order to refund:

```bash
export KEY=<the security key>
psql refunds -c "insert into orders (id, total) values ('6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10', 900)"
```

**A small refund** is recorded at once:

```bash
curl -s -X POST localhost:8885/api/refunds \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"6f1c0a52-2a8e-4d0b-9a77-0b9d7c2f1e10","amount":40,"reason":"Arrived broken."}'
```

```text
HTTP 201
{"id":"7150932f-1f44-4826-af70-d4d5dcef22b4","amount":40.0,"status":"recorded"}
```

**An unknown order** takes the `unknown_order` end:

```text
HTTP 404
{"error":"no such order"}
```

**A large refund** (`"amount":400`) stops at `finance_review`. The response is `202` with a run
descriptor instead of a refund:

```text
HTTP 202
{"run_id":"97b2631a-…","workflow":"refund_request","status":"waiting_human",
 "current_agent":"finance_review","tokens_used":0,
 "approval":{"approval_id":"7a1939d5-…","kind":"human","required_group":"finance_lead",
   "title":"Refund of 400.0","form":{"approved":{"type":"bool","required":true}}}, ...}
```

The run is parked in the database, so it survives a restart. Now approve it. Try with the same key:

```bash
curl -s -X POST localhost:8885/api/approvals/$APPROVAL_ID \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"values":{"approved":true}}'
```

```text
HTTP 403
{"detail":"the principal who triggered this run cannot approve it"}
```

That is a deliberate rule: **nobody approves their own run**. The approver is a different user who
holds the `approvals:decide` scope in the step's group. Create that person (this is also what the
**IAM** page in Insight does). The first administrator comes from `POST /auth/bootstrap`, which works
only while there are no users:

```bash
B=localhost:8885
curl -s -X POST $B/auth/bootstrap -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<a strong password>","first_name":"Ada","last_name":"Admin"}'
AT=$(curl -s -X POST $B/auth/token -d "username=admin@example.com&password=<a strong password>" | jq -r .access_token)
A=(-H "Authorization: Bearer $AT" -H "Content-Type: application/json")

ROLE=$(curl -s -X POST $B/auth/admin/roles "${A[@]}" \
  -d '{"name":"finance_lead","scopes":["approvals:decide","runs:read"]}' | jq -r .id)
USER=$(curl -s -X POST $B/auth/admin/users "${A[@]}" \
  -d '{"email":"lead@example.com","password":"<another password>","first_name":"Lee","last_name":"Lead"}' | jq -r .id)
curl -s -X POST $B/auth/admin/users/$USER/roles/$ROLE "${A[@]}"          # 204
```

Role names become the token's `groups`, which is how `required_group: finance_lead` finds them. Now
the lead signs in, sees the approval and decides:

```bash
LT=$(curl -s -X POST $B/auth/token -d "username=lead@example.com&password=<another password>" | jq -r .access_token)
L=(-H "Authorization: Bearer $LT" -H "Content-Type: application/json")
curl -sL $B/api/approvals/ "${L[@]}"                                   # the lead's inbox
curl -s -X POST $B/api/approvals/$APPROVAL_ID "${L[@]}" -d '{"values":{"approved":true}}'
```

The run continues from where it stopped and finishes on the default end:

```bash
curl -s $B/api/runs/$RUN_ID -H "Authorization: Bearer $KEY" | jq -c '{status, end, output}'
```

```text
{"status":"completed","end":"default","output":{"body":{"id":"3ad7dbf2-…","amount":400.0,"status":"recorded"},"status":201}}
```

```bash
TUVL_URL=http://localhost:8885 TUVL_TOKEN=$KEY tuvl list runs       # every run, with its end
tuvl follow run <run_id>        # follows a run until it ends (Ctrl-C to stop)
```

Every step of every run is journaled, so you can see what happened and replay it. Open Insight
(`http://localhost:8885/insight/`) to look at the same project:

- **Specs** is the task board from stage 5: nine tasks, all in **Done**.
- **Workflows → refund_request** draws the graph (`load_order`, `check_amount`, the orange `finance_review`
  and `record_refund`, and the four ends) and repeats the profile: *4 agents · 3 deterministic ·
  1 external · worst-case 0 tok*.
- **Runs** lists every run. Open the parked one to see the approval form and the journal:
  `load_order → default`, `check_amount` *decided review by rule#2*, `finance_review` *approval
  requested*. Submitting the form as the user who started the run shows the same refusal as the API.
  After the lead decides, the journal adds *approval decided by …*, *resumed* and *run completed
  END.default (201)* with the response, and **Pin as fixture** turns the run into a test that replays
  with zero tokens.

The parked run is a row in your database, so it also survives restarting the engine: stop `tuvl dev`,
start it again, and the run is still `waiting_human`.

!!! note "Dev keys are for development"
    In production there is no session key: callers use signed tokens, and `trigger.http.public: true`
    is the only way to open a route without one. See [Authentication](../internals/auth.md).

## 9. Change it later

The spec stays the source of truth. Suppose finance raises the automatic limit from 100 to 200. Change
the spec first (the flow's rule and the policy), and let tuvl show you what moved:

```bash
tuvl lint spec
```

```text
  ! P005   specs/refund-request.tasks.yaml:11 T2: spec section #flow-refund-request changed since the task was written
  ! P005   specs/refund-request.tasks.yaml:17 T3: ...
  0 blocking · 4 warning(s)
```

```bash
tuvl verify spec
```

```text
    check_amount           decide rules                 :25   ✗ mismatch 3 passed
  ✗ R007  :25   `check_amount`: the workflow's rules differ from the spec's
```

`tuvl show drift` lists the stale tasks and the spec sections no task covers. Now the work is clear:
the workflow still says 100, and four tasks point at a section that changed.

=== "With a coding agent"

    Say it in terms of the spec, and let the agent follow the loop:

    > Finance raised the automatic limit from 100 to 200. Update the spec (the flow rule and the
    > policy) and add an example for a refund of 150. Then bring the task list and the workflow back
    > in line and run the full gate. Do not change the workflow before the spec.

    The `tuvl-plan` skill tells it to refresh the `spec_ref` hashes it has reviewed, to add tasks for
    new steps and to mark removed ones `obsolete: true` rather than delete them.

=== "By hand"

    Change the rule in `workflows/refund_request.yaml` to `amount <= 200`, then refresh the hashes in
    the task list from `tuvl lint spec --json` (the same commands as stage 5), and rerun the gate:

    ```bash
    tuvl lint spec && tuvl verify spec --strict && tuvl run tests --strict && tuvl list tasks --strict
    ```

All four commands exit 0 again. The order matters: **spec first, then the workflow**. If you change
the workflow first, `verify spec` reports a contradiction until the spec catches up.

## 10. Ship it

When the gate is green, shipping is one command. In CI, run the gate on every pull request (this
is the exact gate the [example projects](../examples/example-projects.md) use):

```yaml title=".github/workflows/gate.yml"
name: CI gate
on: [push, pull_request]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - name: Install tuvl
        run: uv tool install --python 3.13 --prerelease=allow "tuvl[standard]>=2.0.0b9,<3"
      - name: Gate
        run: |
          tuvl lint spec
          tuvl lint project --strict
          tuvl generate code --check
          tuvl verify lock --no-mcp
          tuvl run tests --strict
          tuvl verify spec --strict
          tuvl list tasks --strict
```

Then:

```bash
tuvl generate key --write                       # a persistent signing key for production tokens
tuvl ship -t registry.example.com/refunds:1.0    # add --push to push, --no-build to skip docker
```

```text
Step 1/3 — validate
✓ Validation passed
✓ tuvl.lock is current (tuvl 2.0.0b5)
✓ tuvl extras: none — the base install is enough
  not installed: mcp, redis, vector, otel-grpc
Step 2/3 — deploy artifacts
  wrote deploy/Dockerfile
  wrote .dockerignore
  wrote deploy/chart/refunds/Chart.yaml
  ...
  image contents: 16 file(s) — agents/ 2, models/ 3, workflows/ 2, tuvl.lock, ...
Step 3/3 — container image
```

`tuvl ship` runs the same validation first, so nothing ships that does not validate: no `pending`
agents (V010), a current lock (V024), no development files in the image (V027). It then writes:

- `deploy/Dockerfile`, pinned to the tuvl version in `tuvl.lock`, installing only the
  [extras](shipping.md#only-what-the-project-uses) your project uses. This one needs none, so the
  image carries the bare install (about 65 MB of Python packages).
- A `.dockerignore` that is an **allowlist**: only the project's models, workflows, agents, datasources,
  `tuvl.lock` and runtime config enter the image. Specs, tests, task lists, `.env` and the agent
  skills stay out.
- A Helm chart in `deploy/chart/refunds/`, with an optional split into API and worker pods.

Deploy it with the tools you already have:

```bash
kubectl create secret generic refunds-env --from-env-file=.env
helm install refunds deploy/chart/refunds --set image.repository=registry.example.com/refunds
# separate API and worker pods:
helm upgrade refunds deploy/chart/refunds --set split=true --set worker.replicaCount=3
```

The secret must hold `TUVL_SIGNING_KEY` (from `tuvl generate key`), `POSTGRES_PASSWORD`, and the
variable of every model the workflows use (none here). A production engine refuses to start while
one is missing. The container runs in production mode: no dev routes, no Insight, JSON logs. The chart
does not include Postgres, so point `POSTGRES_HOST` at yours. More: [Shipping to production](shipping.md).

!!! info "`tuvl deploy` is coming"
    A hosted, managed tuvl engine that runs your backend services is planned, so there is no image or
    cluster to operate. `tuvl deploy` is the command for it. It is not available yet: today it prints a
    message, deploys nothing and exits 1. Until then, `tuvl ship` plus `helm` is the way.

### Optional: list it in the catalogue

Every project already carries an identity file, `.tuvl/project.yaml`, with a stable id and your git name
and email. If you want the project listed in the public catalogue at nest.tuvl.io, look first:

```bash
tuvl show project
tuvl set project description "Refund approvals: small refunds at once, large ones wait for a lead."
tuvl register project          # prints the exact payload and asks; answer n to only look
```

Registering is public and is tied to the GitHub account you sign in with. **The author name in the
listing is your git name**, so check it first (`tuvl set project author "…"`). Your email stays
private unless you add `--public-email`, and nothing about your workflows, models or data is sent. If
you use a coding agent, it will not register on its own: it only does so when you ask. Details,
every field and the error messages: [Project and Catalogue](../internals/project.md).

## Troubleshooting

| You see | It means | Do this |
|---|---|---|
| `S007  Order is marked (existing) but is not in models/` | The spec names a model that has no `ModelDefinition` | Add `models/order.yaml` |
| `P003  no task list yet` | There is no `specs/<name>.tasks.yaml` | Write it (stage 5) |
| `[V001] ...decide.rules[0].then: Field required` | A decide rule is not `{ when, then }` | Use `- { when: "expr", then: value }`, last `when: "true"` |
| `no generated test for example '...' — run tuvl generate code` | The example has no test yet | `tuvl generate code` |
| `tuvl.lock is missing` / `[V024] tuvl.lock is out of date` | The lock does not match the project or the installed tuvl | `tuvl generate lock`, review, commit |
| `P005  spec section ... changed since the task was written` | The spec moved after the task list was written | Update the tasks and refresh their hashes |
| `R007  the workflow's rules differ from the spec's` | The workflow and the spec disagree | Change the spec first, then the workflow |
| `STUBBED` in `tuvl run tests --strict` | The test only passed through a `pending` agent | Implement the agent |
| `403 the principal who triggered this run cannot approve it` | You approved your own run | Approve as another user in the step's group |
| `Ship aborted — the kept Dockerfile does not install tuvl[...]` | The project now needs an extra the old Dockerfile lacks | `tuvl ship --force` |
| `needs the 'codegen' extra: pip install 'tuvl[codegen]'` | A development command on a bare install | Install `tuvl[standard]` |

## Cheat sheet

| I want to | Run |
|---|---|
| Start a project | `tuvl init <name> -y --preset <provider>` |
| Start a spec | `tuvl create spec <name>` (or `tuvl import idea <brief>` then `tuvl generate spec`) |
| Approve a spec / derive its tasks | `tuvl approve spec <spec>` / `tuvl generate tasks <spec>` |
| Build the tasks with your coding agent | `tuvl generate code --spec <spec> --all` |
| Review the agents' Python | `tuvl review code` (`--agent` for a second opinion) |
| See what was done to the project | `tuvl show audit` (or Insight → Audit) |
| Check the spec / the build against it | `tuvl lint spec` / `tuvl verify spec` |
| See what to do next | `tuvl list tasks` (`--json` for agents) |
| See what changed since the plan | `tuvl show drift` |
| Generate schemas, stubs, tests | `tuvl generate code` (`--check` in CI) |
| Check the workflows | `tuvl lint project --strict` |
| Run the tests | `tuvl run tests --strict` |
| Pin models and tools | `tuvl generate lock` (`--check` in CI) |
| Run it locally | `tuvl dev --show-key` |
| Look at runs | `tuvl list runs`, `tuvl follow run <id>` |
| Serve it to a coding agent | `tuvl serve mcp` |
| Package it | `tuvl ship -t <image>` (`--format archive` for a zip/tar you run with `uv`) |
| Look at, edit or publish the project's identity | `tuvl show project`, `tuvl set project`, `tuvl register project` |

## Where next

- [Quickstart](quickstart.md): the same flow on the built-in triage sample, which includes an `llm` step.
- [Spec-driven development](../internals/spec-driven.md): the full grammar and every rule code.
- [Engines](../internals/engines.md): `code`, `tool`, `decide`, `llm`, `loop`, `map` and `human` in depth.
- [Build with coding agents](coding-agents.md): the skills and the MCP server.
- [Shipping to production](shipping.md): extras, the chart, Laya, Redis and storage.
