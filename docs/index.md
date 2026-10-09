# tuvl

**Typed workflows of agents — deterministic where they can be, bounded where they can't — on a durable, journaled runtime, built spec-first.**

!!! note "tuvl 2.0"
    tuvl 2.0 is a redesign with no 1.x compatibility layer: workflows are graphs of typed
    **agents**, every run is durable and journaled, and projects are built from specs. Versions follow
    [SemVer](https://semver.org).

!!! tip "Try it live — no install"
    Run any [example](https://github.com/tuvl-io/examples) in a throwaway browser sandbox at
    **[try.tuvl.online](https://try.tuvl.online)** with the **Insight** editor.

<p align="center">
  <em>Pronounced "Thoo-val" (തൂവൽ) in Malayalam — a feather.</em>
</p>

---

## What is tuvl?

A tuvl workflow is a graph of **agents**. Each agent has a typed contract — `inputs`, `outputs`, the
signals it emits — and an **engine** that implements it. Signals route to the next agent or a named
end. tuvl checks the whole graph statically (contracts, data flow, types, policy, worst-case cost)
and runs it on a durable runtime that records everything it does.

```yaml title="workflows/refund_flow.yaml"
kind: Workflow
version: tuvl/v2
metadata: { name: refund_flow, description: Handle a refund request }
spec:
  models: [Order, Refund]
  trigger:
    http: { path: /api/refunds, method: POST }
    input: { order_id: uuid, reason: str }
  agents:
    - id: load_order
      description: Load the order
      engine: tool
      inputs: { order_id: uuid }
      outputs: { order: Order }
      tool: { use: db, model: Order, op: read, where: { id: "{{ order_id }}" } }
      routes: { default: triage, not_found: END.missing, error: END.failed }
    - id: triage
      description: Decide how the refund is handled
      engine: decide
      inputs: { order: Order, reason: str }
      outputs: { lane: "enum[auto, review]" }
      decide:
        rules:
          - { when: "order.total > 500", then: review }
          - { when: "true", then: auto }
      routes: { auto: issue_refund, review: approval, error: END.failed }
    # issue_refund (code) and approval (human) …
  outputs:
    default: { status: 200, body: { refund_id: "{{ refund.id }}" } }
    missing: { status: 404, body: { error: unknown order } }
    failed:  { status: 500, rollback: true, body: { error: refund failed } }
```

## Key features

<div class="grid cards" markdown>

-   :material-shape-outline:{ .lg .middle } **Seven engines, one contract**

    ---

    `code`, `tool` (DB/HTTP/MCP), `decide` (rules, then a model), `llm`, `loop` (bounded tool
    use), `human`, and `pending` contracts. Swap an engine without touching the graph.

-   :material-scale-balance:{ .lg .middle } **Deterministic first**

    ---

    Every workflow has a determinism profile and a worst-case token cost. Rules decide before models;
    an unavailable model is an error, never a silent fallback.

-   :material-database-sync:{ .lg .middle } **Durable runs**

    ---

    Runs survive restarts, wait for people, pause and resume on any worker, and compensate on
    rollback. Every run is journaled.

-   :material-replay:{ .lg .middle } **Record, replay, test**

    ---

    Pin any run as a fixture and replay it with zero tokens. Offline tests with typed mocks;
    calibrated, cached judges for free-text checks.

-   :material-file-document-edit:{ .lg .middle } **Spec-driven**

    ---

    Write intent in a spec; analysis proposes contracts and a task plan; codegen, validation and
    task status are deterministic. Coding agents use the same tools over MCP.

-   :material-monitor-dashboard:{ .lg .middle } **Insight**

    ---

    Specs and task board, a canvas over the same YAML, runs with breakpoints, step mode and
    approvals, change-engine checks, judge calibration.

-   :material-api:{ .lg .middle } **REST, SSE and MCP**

    ---

    Typed OpenAPI from contracts, journal events over SSE, workflows as MCP tools, and a typed
    TypeScript client.

-   :material-shield-lock:{ .lg .middle } **Governed**

    ---

    Biscuit tokens, default-deny triggers, approvals without self-approval, secure fields kept away
    from models, policy checked before you ship.

</div>

## Where to start

- [Installation](getting-started/installation.md) and the [Quickstart](getting-started/quickstart.md)
- The [Agentic Manual](internals/tuvl-agentic-manual.md) — the complete document contract
- [Spec-driven development](internals/spec-driven.md) and [building with coding agents](getting-started/coding-agents.md)
- [Engines](internals/engines.md), [Runtime and journal](internals/runtime.md), [Insight](internals/insight.md)

## AI agent instructions

- <a href="assets/AGENTS.txt" download="AGENTS.md">⬇️ Download <code>AGENTS.md</code></a> — the rules for coding agents working in a tuvl project
- <a href="assets/skills.zip" download="skills.zip">⬇️ Download <code>skills.zip</code></a> — the tuvl 2.0 skill set (unzip to `.agents/skills/`; `tuvl skills update` does this for you)

## License

tuvl is open source software licensed under the MIT license.
