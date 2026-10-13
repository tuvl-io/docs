# Build with coding agents

tuvl is designed so a coding agent (Claude Code, Cursor, Codex, Kiro, …) can build a project from a
spec without guessing: tuvl tells it the state of the project, and deterministic tools do everything
except the parts that need judgement.

## What a project gives the agent

- **`AGENTS.md`** at the root and **skills** in `.agents/skills/` (mirrored to `.claude/skills/`),
  scaffolded by `tuvl init` and refreshed with `tuvl skills update [--diff]`:

  | Skill | Use it when |
  |---|---|
  | `tuvl-spec` | writing or changing `specs/<name>.md` |
  | `tuvl-plan` | turning a spec into contracts and tasks |
  | `tuvl-task-loop` | **always** — the core loop for implementing tasks |
  | `agent-code` / `agent-tool` / `agent-llm` / `agent-loop` / `agent-decide` / `agent-human` | implementing an agent with that engine |
  | `tuvl-data` | models, fields, access, CRUD |
  | `tuvl-test` | tests, mocks, fixtures, judges |
  | `tuvl-harden` | changing a working workflow safely |
  | `tuvl-ship` | lock, CI gate, shipping |

- **`--json` on every read command** (`validate`, `spec status`, `spec diff`, `test`, `runs`, …), with
  documented schemas.
- **`tuvl mcp`** — the same operations as MCP tools over stdio.

## Connect `tuvl mcp`

```json title=".mcp.json"
{ "mcpServers": { "tuvl": { "command": "tuvl", "args": ["mcp", "-d", "."] } } }
```

Read tools: `validate`, `spec_status`, `spec_diff`, `get_contract`, `list_agents`, `explain_error`,
`get_run`, `get_run_events`, plus dry runs of `spec_analyse`, `codegen` and `test`. Add
`--allow-write` for `spec_apply`, `codegen_write`, `run_workflow` and `pin_fixture`. Run tools talk to
a running server through `TUVL_URL` / `TUVL_TOKEN`. `tuvl mcp` refuses to run in production.

## The loop

1. `tuvl spec status --json` → the next unblocked task and its target.
2. `tuvl codegen` → typed schemas and stubs for the target.
3. Implement: the YAML engine block, or the body of a `code` agent's function.
4. `tuvl validate --json` → fix every error on the target.
5. `tuvl test` → the task moves to `tested`, then `done`.
6. Repeat until `tuvl spec status --strict` passes.

Task statuses are derived from the project — an agent never sets them. Generated files
(`agents/_generated/`, generated tests, `tuvl.lock`) are regenerated, never edited.

## Downloads

- <a href="../../assets/AGENTS.txt" download="AGENTS.md">AGENTS.md</a> and
  <a href="../../assets/skills.zip" download="skills.zip">skills.zip</a> for agents working outside a
  `tuvl init` project.
