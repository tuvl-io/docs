# Generate Configuration with Coding Agents

tuvl is designed to be **written by an AI coding agent** — Claude Code, Cursor, Copilot, or any agent that edits files in your repo. Because a tuvl backend is a [closed-set contract](../concepts/agentic-contract.md) rather than open-ended code, an agent has a small, validated target and generates working configuration on the first try.

To make that reliable, `tuvl init` scaffolds two things specifically for coding agents:

- **`AGENTS.md`** — the framework rules and architectural invariants (the closed sets, routing rules, the model allowlist, the one-node-per-file rule). Most agents read this file automatically.
- **`.agents/skills/`** — a set of procedural **skills**, one folder per task (each a `SKILL.md`), that walk the agent through *how* to perform a specific job correctly.

Together with the authoritative [TUVL Agentic Manual](https://github.com/tuvl-io/tuvl/blob/main/docs/TUVL_AGENTIC_MANUAL.md), these give an agent everything it needs to emit valid models, workflows, nodes, and agents.

## The bundled skills

Each skill is a short, imperative recipe the agent follows. `tuvl init` writes these under `.agents/skills/<name>/SKILL.md`:

| Skill | What the agent does |
|---|---|
| `create-database-model` | Define a `ModelDefinition` (table + auto-generated CRUD). |
| `implement-api-endpoint` | Create a `Workflow` with an HTTP trigger and routed steps. |
| `create-custom-python-node` | Add a one-per-file `@node()` `functional` runner. |
| `perform-database-operations` | Use `model-op` for CRUD inside a workflow. |
| `implement-llm-agent-step` | Add a single-call `agent` step with structured output. |
| `build-autonomous-agent` | Add an **`AutonomousAgent`** — a bounded tool-calling loop. |
| `invoke-external-api` | Call an external HTTP API with `api_call`. |
| `execute-mcp-tool` | Call an MCP server tool with `mcp`. |

## Step-by-step

### 1. Scaffold a project

```bash
uv tool install tuvl
tuvl init my-app --sample
cd my-app
```

This writes `AGENTS.md`, `.agents/skills/`, and a runnable sample (models, a workflow, nodes, tests). To skip the agent scaffolding, pass `--no-ai-skills`.

!!! tip "Already have a project?"
    Add the agent context to an existing project without re-scaffolding — download both files from the home page and drop them in your repo root:

    - [`AGENTS.md`](../assets/AGENTS.txt) — framework rules
    - [`skills.zip`](../assets/skills.zip) — unzip into `.agents/skills/`

### 2. Point your agent at the project

Open the project in your coding agent. It picks up `AGENTS.md` automatically (Claude Code, Cursor, and most agents read a root `AGENTS.md`). If yours doesn't, tell it once: *"Read `AGENTS.md` and `.agents/skills/` before generating any tuvl config."*

### 3. Ask in plain language

Describe what you want; the agent maps it to a skill and fills the closed-set schema:

> *"Add a `Customer` model with name, email, and tier, then a workflow at `POST /api/tickets` that triages a support ticket: an autonomous agent looks up the customer's orders and either resolves or escalates."*

The agent uses `create-database-model`, then `build-autonomous-agent`, declaring its tools as other steps and mapping every outcome in `routes:`.

### 4. Validate before running

The contract is enforced at load time — validate the generated YAML:

```bash
tuvl validate
```

This catches an invalid `kind:`, an unmapped signal in `routes:`, a tool `ref` that doesn't resolve, a model missing from `spec.context.models`, or a node filename that doesn't match its `@node()` name — **before** the engine boots.

### 5. Inspect and test the run

- **[Spectrum](../tools/spectrum.md)** — step through the generated workflow in the Insight portal and watch each node (including every autonomous-agent iteration and tool call) execute live.
- **[`tuvl test`](../tools/testing.md)** — run LLM-as-a-Judge test cases. Stub an agent step's output to make a nondeterministic agent deterministic for assertions.

## The rules your agent follows

`AGENTS.md` encodes the [agentic contract](../concepts/agentic-contract.md) as hard rules. The ones that matter most:

- **Closed sets only.** Step kinds are exactly: `functional`, `agent`, `AutonomousAgent`, `router`, `api_call`, `mcp`, `model-op`, `response`, `HumanInTheLoop`. Document kinds and reserved context keys are likewise fixed. The agent never invents new ones.
- **Route every signal.** Every non-`default` signal a step can emit must be mapped in `routes:`. For an `AutonomousAgent`, that means every `outcome.enum` value plus the reserved exits `max_iterations` / `budget_exceeded` / `error`.
- **Allowlist every model.** Any model a workflow touches must be listed in `spec.context.models`.
- **One node per file.** A `@node("name")` runner must live in `nodes/name.py`.

Because these are validated at load time, a generation that breaks a rule fails fast instead of shipping a subtle bug.

## Generated example: an autonomous agent

A prompt like *"triage the ticket: look up the order, then resolve or escalate"* produces config of this shape — the agent's tools are other declared steps, and a downstream `router` does the deterministic branching:

```yaml title="workflows/triage_ticket.yaml"
- id: triage
  kind: AutonomousAgent
  agent:
    model: default
    goal: "Resolve the support ticket using the available tools."
    max_iterations: 8
    tools:
      - ref: lookup_order
        description: "Fetch order details by order id."
        parameters:
          type: object
          properties: { order_id: { type: string } }
          required: [order_id]
    outcome:
      enum: [resolved, escalate]
      output_key: agent_result
  routes:
    resolved:        route_by_region    # deterministic switch, NOT the agent
    escalate:        notify_manager
    max_iterations:  fallback_summary
    error:           alert_ops

- id: route_by_region
  kind: router
  match: { field: customer.region }
  routes: { US: reply_us, EU: reply_eu, default: reply_other }
```

See [Workflows → Step Kinds](../concepts/workflows.md#step-kinds) for the full schema of every kind.

## Next steps

- [The Agentic Contract](../concepts/agentic-contract.md) — why closed-set generation works
- [Workflows](../concepts/workflows.md) — step kinds and routing reference
- [Custom Nodes](../examples/custom-nodes.md) — the `functional` escape hatch
- [Testing Workflows](../tools/testing.md) — validate generated config with LLM-as-a-Judge
