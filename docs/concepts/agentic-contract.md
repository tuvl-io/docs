# The Agentic Contract

Why tuvl is the backend you hand to an AI coding agent — and why the agent gets it right the first time.

## The problem with prompting backends

Ask an AI agent to write imperative backend logic — routing, auth, persistence, streaming — and it generates plausible Python across many files. Plausible is not the same as correct: the surface area is unbounded, so the third attempt still has a subtle bug, and nothing catches it until runtime.

tuvl removes the unbounded surface. Instead of generating arbitrary code, the agent fills in a **closed-set schema** — a finite, enumerable contract. There are only so many valid shapes a tuvl project can take, and every one of them is validated the moment it loads.

## What "closed set" means

Three things are finite and fixed in tuvl. An agent (or a human) never invents new ones:

- **Step kinds** — a workflow step is exactly one of: `functional`, `agent`, `AutonomousAgent`, `router`, `api_call`, `mcp`, `model-op`, `response`, `HumanInTheLoop`.
- **Document kinds** — every YAML file declares a `kind:` from a fixed set (`Workflow`, `ModelDefinition`, `DataSource`, `AgentModel`, `RedisConfig`, `FederationProvider`, `TelemetryConfig`, and the embedding/collection/project/system configs). See the [agentic manual](https://github.com/tuvl-io/tuvl/blob/main/docs/TUVL_AGENTIC_MANUAL.md) for the authoritative list.
- **Reserved context keys** — engine-owned keys (`_session`, `_db`, `_response`, `_last_error`, …) that workflows read but must never mutate.

Because the grammar is bounded, a coding agent has a small, well-defined target. It cannot reach for "any function, any class, any decorator" — only the kinds that exist. That is the entire reason an agent can generate a valid tuvl backend on the first try.

## Enforced at load time, not at runtime

The contract is not a convention — it is checked by Pydantic when the project loads, and violations refuse to start:

- A `kind:` outside the closed set → load fails.
- A step that emits a non-`default` signal with no matching entry in `routes:` → `RuntimeError`.
- A workflow that touches a model absent from `spec.context.models` → `PermissionError`.
- A custom node whose filename doesn't match its `@node("name")` decorator → rejected.

This is what "no silent failures" means: an invalid backend never boots, so a wrong generation surfaces immediately instead of in production. The [Workflow Canvas test mode](../tools/workflow-testing.md) and [Spectrum](../tools/spectrum.md) let you watch this validation fire live as you edit.

## The escape hatch

A closed set is only practical if there is a way out when the fixed kinds aren't enough. In tuvl that door is the **`functional` step kind**: it runs arbitrary Python from a custom node, so anything the declarative kinds can't express drops cleanly into code — without abandoning the contract for the rest of the workflow. See [Nodes](nodes.md).

## Why it matters for agents

| Hand-written imperative backend | tuvl agentic contract |
|---|---|
| Unbounded surface — any code, anywhere | Finite, closed-set schema |
| Errors surface at runtime, after deploy | Rejected at load time by Pydantic |
| Agent guesses structure, iterates | Agent fills a known shape, first try |
| Review every line | Review a declarative config |

The closed set is the contract. The agent generates the configuration; the [stateless ASGI router](architecture.md) executes it.

!!! tip "Hand it to your coding agent"
    `tuvl init` scaffolds an `AGENTS.md` and a set of `.agents/skills/` so Claude Code, Cursor, or any coding agent generates valid config against this contract out of the box. See [Build with Coding Agents](../getting-started/coding-agents.md).
