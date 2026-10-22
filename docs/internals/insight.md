# Insight

Insight is tuvl's browser UI for building and debugging a project. It is served by `tuvl dev`
(dev mode only) at `/insight`, talks to the server over REST and SSE, and edits the **same YAML
files** as your editor and coding agents — there is no separate canvas model.

```bash
tuvl dev                 # http://localhost:8885/insight — asks for the session key
tuvl dev --auto-login    # skip the key screen on this machine
```

## Pages

| Page | What it does |
|---|---|
| **Ideas** | The ideas imported with `tuvl import idea` (`IDEA-XX-NNNN`), newest last: title, who and when, a preview of each file's text (extracted from PDFs and Word files), the specs drawn from it with their approval, and what superseded it. Read-only: import and drafting are CLI actions (approval is on the Specs page) |
| **Specs** | Every spec is a tile across the top (task progress, stale/blocked markers, a ✗ badge for blocking `lint spec` findings); click one to show it below, double-click (or **Open spec**) to edit it in its own window, with `lint spec` findings inline — saving there refreshes the page. A tile of a spec under approval shows its state (**draft**, **approved**, or **approved, changed since** once its body was edited), and above the task board a strip shows the pipeline: idea → spec (who approved it) → task progress. **Approve**, **Send back…** (with a reason), **Reopen** and **Derive tasks** sit beside the tabs; each runs the same command as the terminal (`approve spec`, `reject spec`, `reopen spec`, `generate tasks`), with the same checks, the same audit entry and your name from `tuvl init`. Below: **Tasks** (the list `tuvl generate tasks` derives, statuses derived; click a card for the task in full: what it builds, why it is not done, what it waits for and the spec section it came from; a blocked task says why, a failed run lists every attempt (which check failed, the problems found, the end of the agent's output) under **Why it failed**, and its **Run with my agent** is disabled until what it waits for is done, with buttons to open the spec or what it builds; the panel floats, drags, resizes and pops out into its own window, and **Run with my agent** builds the task with your coding agent after you confirm that it spends your tokens, streaming what it prints), **Graph** (the tasks as a dependency tree, top to bottom in execution order, tasks that do not depend on each other on the same step: done, running now, failed, blocked, in progress, ready; click a node for the task in full), **Findings** (blocking, warnings, waivers, unchecked prose) and **Traceability** (`verify spec`: step → agent ✓ / pending / mismatch → the tests that run it, each example's test result with why; a step opens its node on the canvas, and the canvas links back) |
| | A banner on the workflow lists why it cannot run when it names a disabled or undefined model (the API answers `409`) |
| | On the canvas, **Run** / **Step** are disabled while a model the workflow uses isn't configured (`/health` → `tuvl check system`) |
| **Workflows** | Canvas and YAML editor for each workflow (below) |
| | A `code` agent's **Engine** tab is a Python editor for `agents/<file>.py` (⤢ full screen, ⌘S / **Save Python**). Saving is syntax-checked, normalized by codegen (decorator, signature and docstring come from the contract; your body is kept) and reloads the agent. **✦ Assist** writes or changes the body with one of the project's LLM AgentModels: it is given the agent's contract, the fields of its models and the `agent-code` rules, returns the whole file into the editor (↶ undo) and saves nothing; unconfigured models are disabled |
| **Audit** | This machine's ledger of what was done to the project (`tuvl show audit`): import, approval, task derivation, agent runs, branches and pull requests, with refusals. Filter by idea / spec / task id (an idea also shows its specs and tasks), kind and actor; click an event for its JSON; ids link to their pages; **live** polls for new events; the badge says whether the hash chain still holds. Read-only; it holds ids and hashes, never prompts or file contents |
| **Runs** | Live and past runs, journal timeline per agent (loop turns, tool calls, decisions, judge verdicts), approvals inbox with forms and tool-call approve/edit/reject, pause/resume/abort/steer, start a run, pin a run as a fixture, replay fixtures (SAME/DIFF) |
| **Artifacts** | Prompts, steering, skills, guardrails, hooks, MCP servers; **judge editor** with try/calibrate; **rules editor** with "which rule matches" |
| **Models**, **Datasources**, **Embeddings**, **Collections** | Data configuration. The Models page edits `secure` (the **Sec** column): a secure field is redacted from logs, spans and model prompts |
| **AI Models** | `AgentModel`s — LLM (provider/model id, base URL, key reference, parameters) or **Decision** (provider `laya`/`jev`/`llm` + model) |
| **IAM**, **Federation**, **Settings**, **API Docs** | Users and roles, OAuth providers, system settings (incl. the CRUD kill switch), the **Project** identity and catalogue registration ([project](project.md)), OpenAPI |

## Workflows: the canvas

- **Start card**: trigger (HTTP path/method/public, schedule, MCP export) and the typed input.
  Its panel has an **API** and a **Schedule** checkbox (both can be on). Unticking API keeps the path and
  unmounts the route; the schedule takes a cron expression (checked as you type, with the next three
  fire times), one field per trigger input for what scheduled runs start with, and shows the last
  scheduled run and whether the scheduler is running.
- **Agent cards**: engine, determinism class, `id`, description, input/output contract, budget and
  retry chips, one outlet per routable signal. Red ports mark inputs not produced upstream.
- **End cards**: one per named output, with status and body.
- **Palette**: Deterministic (Code, Database op, HTTP call, MCP tool, Vector search, Vector ingest),
  AI (LLM call, Autonomous loop), Control (Decide, Human approval), Contract only (Pending agent). A new
  agent is wired after the selected one when that one ended the workflow.
- **Panel tabs**: Contract (fields with type suggestions and upstream outputs) · Engine (rules table
  for decide, a YAML block editor per engine) · Budget · Governance · Routes · Probe (run this one
  agent with hand-entered inputs).
- **Summary bar**: determinism profile, worst-case tokens and live validation of the draft; a
  data-flow overlay draws each output key to its consumers.
- Canvas and YAML tabs edit the same text (comments are kept); node positions are stored in
  `.tuvl/layout/<workflow>.json`. **Save** writes the file; **Discard** drops the draft.

### Run, debug, pin

- **▶ Run** starts a dev run with an input form; **⏯ Step** pauses before every agent and every loop
  tool call.
- Click a card's dot to set a **breakpoint** (`.tuvl/breakpoints.json`): dev runs pause before that
  agent. While paused, the Runs page shows the agent's input view; edit it and **Continue**.
- **📌 Pin as fixture** on a finished run writes `tests/fixtures/<workflow>/<name>.journal.json`.

### Change engine

**Change engine…** swaps an agent's engine and keeps its id, inputs, outputs and routes (the
signals of a code agent become the decision enum when switching to decide). Then:

- **⇄ Check vs fixtures** replays the workflow's pinned fixtures against the **unsaved draft**, with
  only that agent executing and everything else served from the recording — SAME/DIFF per fixture,
  plus the validate profile before and after;
- **⌘ Generate stub** runs codegen when the new engine is `code`.

Breakpoints and step mode never apply to these replays or to `tuvl run tests`.

## Artifacts: judges and rules

- **Judge** — model, rubric, `min_score`, `min_agreement`. **Try**: paste a subject, ask the judge
  (live, using the draft), then mark the verdict ✓ right / ✗ wrong with a label to add it to the
  calibration set (`fixtures/judge/<label>.json`). **Calibration**: run the set and see agreement.
  See [judges](judges.md).
- **Rules** — an ordered `when → then` table (edit, reorder, add, remove) and a context box that
  shows which rule matches.
- **+ New artifact** creates prose artifacts, or judge/rules YAML from a template.

Saving a YAML file reloads the dev server; Insight picks the change up when it is back.

## Dev API

Insight uses `/dev/*` (dev mode only, behind the session key; in dev mode the key is also an
`iam:admin` token for `/api/*`): project summary, raw text files per area, validate (also for a
draft), schema, codegen, tests, specs, layout, breakpoints, runs (start, context, pin, replay),
agent probe, change check, judges and rules. The OpenAPI at `/docs` lists them.
