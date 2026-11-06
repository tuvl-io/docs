# Build with coding agents

There are two ways to work with a coding agent, and both stay open:

- **The open path (this page):** point your agent (Claude Code, Cursor, Codex, Kiro, …) at the project. It uses
  the skills and `tuvl serve mcp` and builds what it likes; `tuvl lint project`, `tuvl verify spec`, `tuvl ship` and CI
  still decide what is accepted.
- **The driven path:** tuvl drives the agent you already have installed, one narrow job at a time on its own
  branch, from an idea to a packaged project. See [Authoring with a coding agent](../internals/authoring.md).

The rest of this page is the open path. tuvl is designed so a coding agent (Claude Code, Cursor, Codex, Kiro, …) can build a project from a
spec without guessing: tuvl tells it the state of the project, and deterministic tools do everything
except the parts that need judgement.

## What a project gives the agent

- **`AGENTS.md`** at the root and **skills** in `.agents/skills/` (mirrored to `.claude/skills/`),
  scaffolded by `tuvl init` and refreshed with `tuvl update skills [--diff]`:

  | Skill | Use it when |
  |---|---|
  | `tuvl-spec` | writing or changing `specs/<name>.md` |
  | `tuvl-plan` | writing and maintaining the task list from a checked spec |
  | `tuvl-task-loop` | **always** — the core loop for implementing tasks |
  | `agent-code` / `agent-tool` / `agent-llm` / `agent-loop` / `agent-decide` / `agent-human` / `agent-map` / `agent-parallel` | implementing an agent with that engine |
  | `tuvl-workflow` | the workflow around the agents: triggers (http, schedule, mcp), file uploads, ends, policy, webhooks, per-signal outputs |
  | `tuvl-data` | models, fields, access, CRUD |
  | `tuvl-test` | tests, mocks, fixtures, judges |
  | `tuvl-review` | reviewing the Python of code agents (the C-rules, then judgement) |
  | `tuvl-harden` | changing a working workflow safely |
  | `tuvl-ship` | lock, CI gate, shipping (`tuvl ship` installs only the tuvl extras the project uses) |

- **`--json` on every read command** (`lint project`, `list tasks`, `show drift`, `run tests`, `list runs`, …), with
  documented schemas.
- **`tuvl serve mcp`** — the same operations as MCP tools over stdio.

## Connect `tuvl serve mcp`

```json title=".mcp.json"
{ "mcpServers": { "tuvl": { "command": "tuvl", "args": ["mcp", "-d", "."] } } }
```

Read tools: `validate`, `spec_status`, `spec_diff`, `get_contract`, `list_agents`, `explain_error`,
`get_run`, `get_run_events`, plus `spec_check`, `spec_verify` and dry runs of `codegen` and `test`. Add
`--allow-write` for `codegen_write`, `run_workflow` and `pin_fixture`. Run tools talk to
a running server through `TUVL_URL` / `TUVL_TOKEN`. `tuvl serve mcp` refuses to run in production.

## The loop

1. `tuvl list tasks --json` → the next unblocked task and its target.
2. `tuvl generate code` → typed schemas and stubs for the target.
3. Implement: the YAML engine block, or the body of a `code` agent's function.
4. `tuvl lint project --json` → fix every error on the target.
5. `tuvl run tests` → the task moves to `tested`, then `done`.
6. Repeat until `tuvl list tasks --strict` passes.

Task statuses are derived from the project — an agent never sets them. Generated files
(`agents/_generated/`, generated tests, `tuvl.lock`) are regenerated, never edited.

## Downloads

- <a href="../../assets/AGENTS.txt" download="AGENTS.md">AGENTS.md</a> and
  <a href="../../assets/skills.zip" download="skills.zip">skills.zip</a> for agents working outside a
  `tuvl init` project.
