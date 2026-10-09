# The `decide` engine

`decide` routes a run through **ordered rules first**, then — only if no rule matches — an optional
**decision model**. Rules-only agents are deterministic and free; a model makes the agent `bounded`.

```yaml
- id: triage_refund
  description: Decide how a refund is handled
  engine: decide
  inputs:  { order: Order, reason: str, message: str }
  outputs: { route: "enum[auto_refund, manager_review, reject]" }   # exactly one enum output
  budget:  { timeout: 2s, retry: { attempts: 1 } }                # applies to the model call
  decide:
    rules:                                 # first match wins
      - { when: "order.total > 500", then: manager_review }
      - { when: "reason == 'fraud_flag'", then: reject }
    # or: rules: artifact://refund-rules@4   (a `type: rules` artifact)
    model:                                 # optional
      ref: triage-classifier               # AgentModel (type: decision) or an llm AgentModel
      min_confidence: 0.8
    shadow: false                          # true: rules decide; the model runs alongside, journaled only
  routes:
    auto_refund:    issue_refund
    manager_review: approval
    reject:         END.rejected
    low_confidence: approval               # required when a model is set
    error:          END.failed             # no_rule_matched, decision_model_unavailable
```

## Semantics

| Situation | Result |
|---|---|
| A rule matches | Its `then`. **The model is not called.** Source `rule#<n>` |
| No rule matches, no model | `error` (`no_rule_matched`) |
| No rule matches, model confident (≥ `min_confidence`) | The model's value. Source `model` |
| No rule matches, model below `min_confidence` | `low_confidence` (proposal and confidence journaled) |
| No rule matches, model **unavailable** (down, auth, timeout after retries) | `error` (`decision_model_unavailable`). **Never** a fallback to rules, a default or another model |
| `shadow: true` | Rules decide (`no_rule_matched` if none matches). The model runs every time; its answer is journaled for comparison and its failures are logged, not errors |

Rules are TEL conditions over the agent's inputs, type-checked by `tuvl validate`. The output enum
must equal the set of normal route keys, and every `then` must be one of its values (V012). A rule
`{ when: "true", then: x }` at the end is the usual default.

Every invocation journals a `decision` event: `{ decision, source: rule#n | model | shadow,
confidence?, model_ref?, latency_ms }`. Tests assert on it with
`expect.decisions: { triage_refund: { source: "rule#1" } }`; Insight shows it on the run timeline.

## Decision models

```yaml
kind: AgentModel
metadata: { name: triage-classifier }
spec:
  type: decision
  provider: litellm                      # laya | jev | litellm
  model: gemini/gemini-2.5-flash         # pinned in tuvl.lock
```

- `litellm` asks any LiteLLM model for an enum-constrained structured answer. An `llm`-type
  AgentModel can also be referenced directly; it uses the same adapter.
- `laya` (local typed-decision model) needs the `tuvl[laya]` extra; `jev` must be pinned to a version.
  Other providers can be registered through the `tuvl.decision_providers` entry point.
- A decide agent with an LLM-backed model must declare `budget.max_tokens` and `budget.timeout`.
- `/health` reports each configured decision model's readiness.

## Rules as artifacts

A `type: rules` artifact is a reusable decision table, edited and tried in Insight (Artifacts page):

```yaml
kind: Artifact
metadata: { name: refund-rules, version: 4 }
spec:
  type: rules
  rules:
    - { when: "order.total > 500", then: manager_review }
    - { when: "true", then: auto_refund }
```

## Policy

`policy.model_only_decisions: warn | error` flags (V013) a model-only decision (no rules) that feeds a
write or destructive effect without a human, approval or `compensate`.

Changing an agent's engine to or from `decide` in Insight keeps its contract and re-checks it against
the workflow's pinned fixtures ([Insight](insight.md)).
