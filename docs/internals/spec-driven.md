# Spec-driven development

Intent lives in a spec; tuvl derives the work and measures progress. Only **analysis** uses a model —
everything after it is deterministic.

```
spec (.md) ──analyse (model, validate-gated)──▶ contracts (pending agents) + TaskPlan
   ▲                                                      │
   │ spec diff: stale tasks                               ▼
   │                                    codegen: schemas, stubs, prompt placeholders, tests
   │                                                      │
   └── derived task status ◀── validate · test ◀── implement (person or coding agent)
                                                          │
                                                   lock · ship
```

## 1. Write the spec

`tuvl spec new refund-automation` writes `specs/refund-automation.md`:

~~~markdown
---
name: refund-automation
owner: support-platform
workflow: refund_flow
---
# Intent
Customers request refunds through the support widget…

# Data
Order (existing), Refund (new: id, order_id, amount, status, created_at).

# Flows
1. Small refunds for damaged goods are automatic. …

# Policies
- Refunds over $500 always need a support manager.
- Max 5k LLM tokens per request.

# Acceptance
```tuvl-example
name: small damaged refund is automatic
input:  { order_id: "…", reason: damaged }
expect: { end: default, path_includes: [issue_refund], output: { body: { amount: 40 } } }
```
- The confirmation reply must state the amount and promise nothing beyond policy.
~~~

- `tuvl-example` blocks become `Test` documents **deterministically**. `decision:` is accepted for
  `decisions:`, and `end_or_wait: X` becomes `wait: X` for `human`/`approval`, else `end: X`.
- Free-text acceptance bullets are classified by analysis as TEL assertions or judge checks.
- Each section gets a stable anchor and a content hash; tasks point at sections.

## 2. Analyse and apply

```bash
tuvl spec analyse specs/refund-automation.md          # dry run
tuvl spec analyse specs/refund-automation.md --apply  # write the saved plan
tuvl spec analyse specs/refund-automation.md --apply --only workflows/refund_flow.yaml
```

- The analysis model (`--model`, or `ProjectConfig.spec.analysis_model`) returns a **structured
  plan** — models, workflows, agents as contracts (`pending`, `decide` or `human`), artifacts,
  policies, tests and tasks. tuvl renders the YAML; the model never writes YAML text.
- The project is validated with the plan applied; errors **the plan introduced** go back to the model
  for at most 2 repairs. A plan that still fails can't be applied.
- The dry run prints the summary, diff, notes, tasks, tokens and cost, and saves the plan to
  `.tuvl/analysis/<name>.json`. `--apply` writes it without another model call and refuses if the
  spec changed since.
- Re-analysis keeps implemented agents' engines and contracts (a contract change is reported, not
  applied), keeps task ids stable, and flags obsolete tasks instead of deleting them.

## 3. The TaskPlan

```yaml
kind: TaskPlan
version: tuvl/v2
metadata: { name: refund-automation, spec: specs/refund-automation.md, spec_hash: 9f2c… }
spec:
  tasks:
    - id: T3
      title: Triage refund requests by amount and reason
      type: agent                 # model | workflow | agent | artifact | integration | test | policy | manual
      spec_ref: { anchor: flows, hash: 41ad… }
      target: { workflow: refund_flow, agent: triage_refund }
      depends_on: [T1]
      effort: { size: M, hours: [2, 4], source: llm }
      status: derived
```

### Derived status

| Status | Rule |
|---|---|
| `todo` | Target agent is `pending`, or the target file is absent |
| `in_progress` | Target has an engine but validate reports errors on it |
| `implemented` | Target validates cleanly |
| `tested` | A passing `Test` (or replayed fixture) covers it, and its acceptance examples pass |
| `done` | Nothing blocks `ship`: lock current, no warnings on the target |
| `blocked` (overlay) | A `depends_on` task isn't `done` |
| `stale` (overlay) | The spec section changed since the plan |

Only `type: manual` tasks take a manual status. Models and artifacts skip `tested`. A task tuvl can't
measure is `untracked`.

```bash
tuvl spec status --json     # derived statuses (runs the tests offline; --no-tests caps at implemented)
tuvl spec status --strict   # exit 1 unless every live task is done and none is blocked or stale
tuvl spec diff              # stale tasks and spec sections no task covers
```

## 4. Codegen

`tuvl codegen [<workflow>] [--check]` — deterministic, no model:

| Output | Rule |
|---|---|
| `agents/_generated/schemas.py` | `<Id>In`/`<Id>Out` models per agent (per-signal variants, `<Id>Signal`), `<Workflow>Input`, `<Workflow>End`. Never hand-edited |
| `agents/<run>.py` | A stub per `code` agent when missing; otherwise a **libcst merge** that regenerates decorator, signature and docstring and keeps parameter names and the **body** |
| `artifacts/<name>.md` | A prompt placeholder for a missing `artifact://` referenced by an `llm`/`loop` agent |
| `decide` agents | A block with neither rules nor model gets one never-matching rule per enum value |
| `tests/<workflow>/<example>.yaml` | `Test` documents from the spec's `tuvl-example` blocks; hand-written tests are never touched |

`--check` exits 1 if anything would change (the CI drift gate). **tuvl never writes function bodies.**

## 5. Lock

`tuvl lock` writes `tuvl.lock`: the tuvl version, each AgentModel's model id, each `artifact://`
ref's version and sha256, judge and decision-model versions, and each allowed MCP tool's input-schema
hash (listed live; `--no-mcp` compares by name only). `tuvl lock --check` verifies it; `tuvl ship`
requires it (V024) and pins the locked tuvl version in the image.

## 6. The CI gate

```bash
tuvl validate --strict && tuvl codegen --check && tuvl lock --check && tuvl test && tuvl spec status --strict
```

`tuvl init <name> --sample` creates a project that passes this gate as created.

## Coding agents

- `tuvl mcp [-d <project>] [--allow-write]` serves the same operations over MCP (stdio): `validate`,
  `spec_status`, `spec_diff`, `get_contract`, `list_agents`, `explain_error`, `get_run`,
  `get_run_events`, `spec_analyse`, `codegen`, `test`; with `--allow-write` also `spec_apply`,
  `codegen_write`, `run_workflow`, `pin_fixture`. It refuses `TUVL_ENV=production`.
- `.agents/skills/` (refreshed by `tuvl skills update [--diff]`, mirrored to `.claude/skills/`):
  `tuvl-spec`, `tuvl-plan`, `tuvl-task-loop`, `agent-code`, `agent-tool`, `agent-llm`, `agent-loop`,
  `agent-decide`, `agent-human`, `tuvl-data`, `tuvl-test`, `tuvl-harden`, `tuvl-ship`, plus a root
  `AGENTS.md` with the non-negotiable rules.
- Every read command has `--json` with a documented schema (`/dev/schema/cli` in dev mode).
