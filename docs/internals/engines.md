# Engines

An agent's **engine** implements its contract. The closed set is `pending`, `code`, `tool`,
`decide`, `llm`, `loop`, `human` and `map`. This page covers `pending`, `code`, `tool`, `llm`, `human`
and `map`;
see [decide](decide.md) and [loop and tools](loop-and-tools.md) for the other two.

Every engine except `pending` can emit `error`. Engine parameters live under a key named after the
engine (`code:`, `tool:`, `llm:`, …).

---

## `pending` — a contract without an implementation

```yaml
- id: classify_ticket
  description: Decide which team owns the ticket
  engine: pending
  inputs:  { ticket: Ticket }
  outputs: { team: "enum[billing, technical, general]" }
  routes:  { billing: billing_queue, technical: kb_search, general: general_queue }
```

- `tuvl lint project` checks it fully as a contract (data flow, types, routes). It is a V010 warning.
- In dev and in tests it returns a **typed stub**: schema-valid placeholder outputs and its first
  normal signal. Tests override it with `mocks`.
- `tuvl ship` refuses a project with `pending` agents, and the production runner won't load one.

A `pending` agent is a typed placeholder for a step the spec names but nobody has built yet; `tuvl verify spec` reports it as unfinished and tests through it are *stubbed*, not passed.

---

## `code` — a Python function

```yaml
- id: issue_refund
  description: Calculate the refund amount and record it
  engine: code
  effect: write                           # read | write | destructive; default write
  inputs:  { order: Order, reason: str }
  outputs: { refund: Refund }
  code: { run: issue_refund, with: { currency: EUR } }
  routes: { default: reply, error: END.failed }
```

```python
# agents/issue_refund.py — one @agent per file
from tuvl import agent, Ctx
from agents._generated.schemas import IssueRefundIn, IssueRefundOut


@agent("issue_refund")
async def issue_refund(inp: IssueRefundIn, ctx: Ctx) -> IssueRefundOut:
    """Calculate the refund amount and record it."""
    amount = inp.order.total if inp.reason != "partial" else inp.order.total / 2
    refund = await ctx.db.create("Refund", order_id=inp.order.id, amount=amount)
    return IssueRefundOut(refund=refund)
```

| | |
|---|---|
| Signature | `async def f(inp: <Id>In, ctx: Ctx) -> <Id>Out` or `tuple[<Id>Out, str]`. `tuvl generate code` writes the decorator, signature and docstring; you write the body. |
| Signals | Returning `Out` emits `default`; `(Out, "signal")` emits that signal (it must be routed); an exception emits `error` (`code_exception`). |
| `ctx.db` | Unit of work restricted to `spec.models`; read-only when `effect: read` (a write raises). Writes commit with the step's checkpoint. |
| `ctx` | `ctx.log` (structlog, bound to the run and agent), `ctx.run_id`, `ctx.principal`, `ctx.idempotency_key`, `ctx.http` (shared HTTP client), `ctx.artifact(ref)`, `ctx.params` (rendered `code.with`), `ctx.agent_id` |
| `effect` | Declared, because it can't be derived from Python. It drives policy (`require_human_before`) and MCP annotations. |

**Built-ins.** `run: tuvl.data_search` and `run: tuvl.data_ingest` are vector search and ingest with
typed contracts, configured by `code.with` (`collection`, `query`/`document`, `top_k`, `filter`,
`metadata`, `scope: global | run`). Search writes `[{content, metadata, score}]` to its single list
output; ingest writes the new document id to its optional single output. The `tuvl.` prefix is
reserved.

---

## `tool` — database, HTTP, MCP and storage operations

One engine, four `use` variants. The **effect is derived**; a declared `effect` may only strengthen
it (V015), except that an HTTP `POST`/`PUT`/`PATCH` may declare `effect: read` (search APIs often
read via POST).

### `use: db`

```yaml
tool: { use: db, model: Order, op: read, where: { id: "{{ order_id }}" } }
tool: { use: db, model: Refund, op: create, values: { order_id: "{{ order.id }}", amount: "{{ amount }}" } }
tool: { use: db, model: Ticket, op: list, where: { status: open }, order_by: [-created_at], limit: 20 }
```

`op`: `create`, `read`, `update`, `delete`, `list`, `upsert`. The model must be in `spec.models`
(V018). The result lands in the agent's single output — a row, or `list[Model]` for `list`; `delete`
has none. Untyped `where` values are coerced to the column type.

| op | Effect | Reserved signals |
|---|---|---|
| `read` | read | `not_found` |
| `list` | read | — |
| `create`, `update`, `upsert` | write | `conflict` |
| `delete` | destructive | `not_found` |

### `use: http`

```yaml
tool:
  use: http
  method: POST
  url: https://payments.example.com/refunds
  headers: { Authorization: "Bearer ${PAYMENTS_KEY}" }
  body: { order: "{{ order.id }}", amount: "{{ amount }}" }
  expect: { status: [200, 201] }
  map: { refund_ref: response.body.id }   # response.status | headers | body paths → outputs
  idempotency: auto                       # auto | none — sends Idempotency-Key
```

`GET`/`HEAD` are `read`; other methods are `write` (override to `destructive` allowed). Without
`map`, a single output receives the body. An unexpected status emits `http_<status>` when that
signal is routed; otherwise `error` (`rate_limit` for 429 and `transient` for 5xx are retryable,
`http_error` otherwise). `${VAR}` reads the environment.

### `use: storage`

```yaml
tool: { use: storage, store: invoices, op: put, key: "{{ id }}.pdf", body: "{{ pdf_b64 }}", encoding: base64 }
tool: { use: storage, store: invoices, op: get, key: "{{ id }}.pdf", as: base64 }
```

`op`: `put`, `get`, `head`, `list`, `copy`, `delete`, `presign`, on a store declared in
`storage/*.yaml` (S3 and compatible services, Azure Blob, GCS, local disk). The result lands in the
single output — the blob for `put`/`head`/`copy`, the content for `get`, the items for `list`, the
URL for `presign` — or is spread by `map`. `get`, `head` and `copy` emit `not_found`; `put` and
`copy` emit `conflict` unless `if_exists: overwrite`; `delete` is destructive. Object bytes are never
journaled. Details: `docs/storage.md`.

### `use: mcp`

```yaml
tool: { use: mcp, server: artifact://zendesk@3, name: add_comment, args: { ticket: "{{ ticket.id }}", body: "{{ text }}" } }
```

The effect comes from the server's `readOnlyHint`/`destructiveHint`, else `write`. The tool's
structured content (or parsed text) fills a single output, or spreads an object across several.
The tool's input schema is pinned in `tuvl.lock`.

### Side effects and crashes

Runs are at-least-once per agent ([runtime](runtime.md)). `tool: db` writes on the primary
datasource commit with the step's checkpoint (exactly-once under `transaction: per_agent`); HTTP
calls get a stable `Idempotency-Key`; MCP calls are at-least-once, so give write/destructive tools a
`compensate` agent (V015).

---

## `llm` — one structured model call

```yaml
- id: reply
  description: Write the customer confirmation
  engine: llm
  inputs:  { order: Order, refund: Refund }
  outputs: { text: str }
  budget:  { timeout: 20s, max_tokens: 1500, retry: { attempts: 2, errors: [parse_error, timeout] } }
  llm:
    model: default                        # AgentModel name (type llm) or a provider/model id (see `docs/models.md`)
    system: artifact://support-voice@3    # text or a prompt artifact
    prompt: Write a short confirmation of the refund.
    skills: [artifact://refund-policy@2]
  guardrails: { output: [artifact://refund-reply-quality@2] }
  routes: { default: END, guardrail_violation: END.failed, error: END.failed,
            parse_error: END.failed, timeout: END.failed, budget_exceeded: END.failed }
```

- Every input is serialised into the prompt inside a `<data name="…" type="…">` fence, and the
  system prompt tells the model that fenced text is data, never instructions. A value can't close
  its fence early (`</data>` inside it is escaped), so retrieved documents, user text or web
  content can't pass themselves off as part of the prompt. `loop` agents fence every tool result the
  same way (`<data tool="…">`). Text you interpolate into `llm.prompt` with `{{ … }}` is not fenced:
  pass untrusted values as inputs.
- The model answers with **structured output** whose schema is the agent's `outputs`.
- With more than one normal route, an `outcome: enum[<those signals>]` field is added and its value
  becomes the signal; a free-form model string can never become a signal.
- `budget.max_tokens` and `budget.timeout` are required (V011).
- Guardrails: `input`/`output` lists of `guardrail` or `judge` artifacts. A failing output judge emits
  `guardrail_violation`; an unavailable or uncertain judge fails closed (`error`).
- Secure model fields can't be inputs unless `policy.allow_secure_to_llm: true` (V020).

---

## `human` — a person fills a form

```yaml
- id: approval
  description: A manager approves or rejects a refund
  engine: human
  inputs:  { order: Order, message: str }
  outputs: { approved: bool, note: "str?" }   # the form
  human:
    title: "Refund for order {{ order.id }}"
    instruction: Approve this refund?
    show: [order, message]                  # inputs shown to the reviewer
    form:                                   # optional; defaults from outputs
      approved: { label: "Approve?", widget: toggle }
      note:     { label: Note, widget: textarea }
    required_group: support_manager
    assignee: "{{ order.owner_id }}"
    expires: 48h
    route_on: approved                      # bool → "true"/"false"; enum → its values
  routes: { "true": issue_refund, "false": END.rejected, expired: END.failed, error: END.failed }
```

- The run checkpoints, opens an **approval request** and becomes `waiting_human`. A synchronous
  trigger answers `202` with the run descriptor and the request.
- Answer with `POST /api/approvals/{id}` `{ values }` (or `POST /api/runs/{run_id}/human/{agent_id}`).
  Values are validated against `outputs`; the run is re-queued and continues on any worker.
- Who may answer: with `required_group`, a holder of `approvals:decide` in that group who is not the
  triggering principal; otherwise the triggering principal or `iam:admin`. `iam:admin` bypasses the
  group, never the no-self-approval rule.
- `expires` closes the request and takes the `expired` route; a late answer gets `409`.
- `form` fields must equal `outputs`; `route_on` must be a bool or enum output (V016).

In tests, an unmocked human agent stops the run: assert it with `expect.wait: human`.

---

## `map` — a workflow for every item of a list

```yaml
- id: score_each
  description: Score every candidate
  engine: map
  inputs:  { candidates: "list[json]", job_id: uuid }
  outputs: { scores: "list[json]" }          # one list: the results, in input order
  map:
    over: candidates                         # an input that is a list
    workflow: score_candidate                # the child workflow, run once per item
    as: candidate                            # the child's trigger input that receives the item (default: item)
    with: { job_id: "{{ job_id }}" }         # further child inputs, templates over this agent's inputs
    concurrency: 4                           # items in flight (1-32, default 4)
    max_items: 100                           # longer lists fail the agent before any item starts (default 100)
    on_error: collect                        # fail (default) | collect
  effect: write                              # the strongest effect of the child; never weaker (V015)
  routes: { default: rank, partial: review, error: END.failed }
```

Fan-out and nothing else: tuvl runs the child workflow once per item, a few at a time, and gathers
the results. The step is one agent of the parent; each item is a **child run** of its own.

- **Each item is a run.** It has its own journal, checkpoints and cost, shows in the run list with
  `parent_run_id` set, and is replayable on its own. The step journals `map_started`, one `map_item`
  per item, and `map_finished`.
- **Idempotent after a crash.** The child of item *i* is keyed `<agent>:<i>`. A parent that is
  reclaimed by another worker and reaches the step again follows the children already started (or
  finished) instead of starting new ones, so no item runs twice.
- **Success is per item.** An item succeeds when its child completes on an end whose status is below
  400; its result is that end's `body`. The result list keeps the input order.
- **`on_error: fail`** stops starting new items at the first failed item and emits `error`
  (`map_item_failed`: which item, why, and how many failed or never started). Items already running
  finish; their runs stay in the journal.
- **`on_error: collect`** runs every item. A failed item is `null` in the results, and the agent
  emits `partial` instead of `default` when the workflow routes `partial` (otherwise `default`).
  `partial` is only valid with `collect` (V004).
- **A mapped workflow must finish on its own (V036):** no `human` or `pending` agent and no loop tool
  that needs approval. A child that waits anyway fails its item.
- **Bounded.** `concurrency` limits parallel items, `max_items` the list length, and
  `policy.max_depth` how deeply workflows nest (a workflow cannot map itself, V035). Worst-case
  tokens in `tuvl lint project` are the child's worst case times `max_items`, and the step takes the
  child's strongest determinism class.
- **Checks (V035):** `over` is a list input; the workflow exists; `as` and every `with` key are inputs of
  the child; no required child input is left out; item and input types agree (V007); `outputs` is
  exactly one list (V007).
- Items run in this worker's process, in parallel; another worker takes over only through crash
  recovery. Nothing is shared between items: they are independent runs, so a map is not a fork/join of
  different branches, only the same workflow over many items.
