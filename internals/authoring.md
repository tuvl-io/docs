# Authoring with a coding agent

tuvl can drive the coding agent you already have installed (Claude Code, Codex, Gemini CLI, …) through
the whole path from an idea to a packaged project, with tuvl choosing what the agent is given and what is
accepted. There are two ways to work, and both stay open:

| | You do | tuvl does |
|---|---|---|
| **Open path** | Point your agent at the project; it uses the skills in `.agents/skills` and `tuvl serve mcp` and builds what it likes. | Nothing in the way. `tuvl lint project`, `verify spec`, `ship` and CI still decide what is accepted. |
| **Driven path** (this page) | Decide: pick the idea, review the spec, approve it, merge the pull requests. | Numbers everything, gives the agent one narrow job at a time on its own branch, checks the result, records it, opens the pull request. |

The claim is not that the agent is deterministic. **Authoring is free; acceptance is deterministic**: the
same checks (`lint project`, `lint spec`, `verify spec`, `generate code --check`, `review`, the tests) say yes or
no, with no model in the loop. The agent's output is only ever a proposal on a branch.

## The path

```text
tuvl init                      who you are, which agent, git on `develop`
tuvl import idea brief.pdf     IDEA-SK-0004: a numbered, immutable copy of the brief (text extracted)
tuvl generate spec --idea IDEA-SK-0004
                               SPEC-SK-0004-01: your agent drafts it on branch spec/SPEC-SK-0004-01
   review, edit               …in a pull request (draft), by people
tuvl approve spec SPEC-SK-0004-01
                               who approved it, when, a hash of the body
tuvl generate tasks SPEC-SK-0004-01
                               the task list, derived (no model): TASK-SK-0004-01-001 …
tuvl generate code --spec SPEC-SK-0004-01 --all
                               models and workflow skeletons deterministically, then your agent builds each
                               task on its own branch, stacked, each a draft pull request
tuvl review code                    the C-rules and ruff on the Python; --agent adds a second opinion
tuvl ship                      the gate again, then the image and/or a runnable archive
```

Everything except the agent's own steps costs no tokens. `tuvl dev` shows the same path as a tree
(ideas → specs → tasks) in a terminal UI, and Insight shows it in the browser and does the same things.

**In Insight, on the Ideas page:** **Upload idea** takes files, a folder or text you write there and runs `tuvl import idea` on
them (the same numbering from your initials, the same hashes and audit entry; with several files the idea is titled from the first,
so give it a title). **Generate a spec with my agent** runs `tuvl generate spec --idea` with the agent you chose (`tuvl use agent`),
shows its output as it goes, and asks for your consent the first time. The draft goes into the project uncommitted, so the Specs
page shows it at once, or onto a `spec/<id>` branch with nothing pushed (then the idea must be committed: tick **Commit it to
git** when you upload). Then approve the spec and derive its tasks from the same page.

### Ids
`IDEA-SK-0004` → `SPEC-SK-0004-01` → `TASK-SK-0004-01-003`: a spec and a task carry their idea's number,
so only the idea id is allocated freely, from your initials (asked by `tuvl init`). If two people pick the
same number on different branches, `tuvl check system` finds it and `tuvl renumber idea` fixes it and every link.

### What is committed
Committed: `idea/`, `specs/` (the spec with its approval fields, and its task list), the models, workflows,
agents and tests tuvl and your agent write. **Not committed** (your machine only, git-ignored):
`.tuvl/agent.yaml` (your initials, your agent, your consent), `.tuvl/audit/` (the ledger),
`.tuvl/trace/` (prompts and agent output, by hash), `.tuvl/live/`, `.tuvl/worktrees/`.

## What an agent may do

tuvl lets an agent **change files** only when its headless mode can confine the change; otherwise it is
used to **review** (read and answer) only.

| Agent | Drafts specs and builds tasks | Reviews | How it is confined |
|---|---|---|---|
| Claude Code | yes | yes | `--restricted`: no code-running tools, file tools limited to the folder, nothing may prompt; review has only Read, Glob, Grep |
| Codex CLI | yes | yes | its sandbox: `workspace-write` (the folder only), `read-only` for review |
| Gemini CLI | yes | yes | `auto_edit` approves edit tools only (a shell call is denied when nothing can answer it); `plan` for review |
| Cursor, Antigravity, Copilot CLI, Amp | no | yes | no per-run way to allow writes in one folder, so tuvl never grants one |
| `generic` (`tuvl use agent generic --command '…'`) | yes | yes | not confined: any command that reads the prompt on stdin; only the check of what changed protects you |
| Qwen Code, Aider, OpenCode, Goose | not yet | not yet | listed and detected; headless flags not checked |

The Claude Code adapter was exercised against the real tool. The others were written from each vendor's
documentation and tested with stand-ins; `tuvl check agent` runs yours once so you can see that it works.

Whatever the agent is, tuvl then enforces what it cannot be trusted with:
- **Scope.** `generate spec` may change one spec file; a codegen task may change its workflow, `agents/*.py`
  and `artifacts/`. Any other change is reverted and the agent is told which file it may not touch.
- **Lifecycle fields.** `id`, `ideas`, `status` are put back after the agent runs; an approval it writes is
  removed. An agent cannot approve its own draft, and tuvl never approves for you.
- **Acceptance.** A draft must pass `lint spec`; a task must leave its step implemented, with `lint project`
  and `verify spec` agreeing, and the Python without C-rule errors. Findings go back to the agent for
  another try (3 by default). A task that never passes leaves no branch behind.
- **Pull requests are opened, never merged.** Drafts by default; the stack is based branch on branch.
- **Consent.** Your first agent run asks (or needs `--consent`) before idea and project files are sent to
  your agent; it is recorded in the ledger.
- **Prompts are not in git.** The ledger holds ids, hashes and short details; the full prompt of every
  run is in `.tuvl/trace/` by hash, so you can see exactly what was sent.

## Review

`tuvl review code` checks the Python of code agents with rules C001–C012 and `ruff`, free. Errors fail;
`--strict` makes warnings fail. `tuvl review code --agent` asks an agent that cannot change anything for a
second opinion as JSON findings; it is advisory unless you pass `--blocking high`. `generate code --spec`
reviews every task before committing it (`--review static` by default).

## Building the UI

`ui/specs/` (created by `tuvl init`) holds the guidelines for whoever builds the frontend, developer or coding
agent. `tuvl generate ui-spec` writes it from the implemented project, with no model: an index that recommends
`@tuvl/client` (install, generating types, sign-in, the rules for a UI), one file per workflow whose tasks are
done (the endpoint and who may call it, the request, every end's status and body, the `202` run lifecycle, the
approval form of human steps, real examples from the acceptance cases, a `client.execute(...)` snippet and a
checklist), one for the models with CRUD routes, and `ui-contract.json` with the same facts as data.
`generate code --spec` adds a workflow's file in the commit of the task that completes it, so what is documented is
what exists. Write your own notes below the marker at the end of a file; they survive regeneration.
`tuvl verify ui-spec` fails when the files are stale (use it in CI).

## Shipping

`tuvl ship` re-runs the gate first: specs under approval approved and unchanged, `lint spec` and
`verify spec` clean, tasks done, generated files current, no C-rule errors, a current `uv.lock`, a clean
tree. Then `--format image` (the default) builds the image labelled with a hash of its runtime files and
the commit, `--format archive` writes a reproducible `tar.gz` or `zip` you run with `uv` on a host without
Docker, and `both` does both. Nothing is deployed; `tuvl deploy` is for hosted tuvl.

## CI

`tuvl init --ci github` (or `gitlab`) writes the same gate as CI: on pull requests the checks that fail
on errors (a scaffold or a half-built stack legitimately has pending steps), on pushes to `develop` and
`main` everything `--strict`.

## When something stops

| You see | Because | Do |
|---|---|---|
| `No coding agent selected` | `.tuvl/agent.yaml` says `none` | `tuvl use agent claude` |
| `X can review code through tuvl, but cannot draft or build yet` | that agent has no confined write mode | pick Claude Code, Codex or Gemini for this step |
| `IDEA-… is not committed on develop` | a draft starts from the base branch | `tuvl import idea --commit`, or commit `idea/` |
| `is not on develop: merge the spec's pull request first` | codegen starts from the approved spec | merge the spec's PR, or `--base spec/SPEC-…` |
| `is not approved` | a spec edited after approval is a draft again | `tuvl approve spec` |
| `Needs your consent` | first agent run, no terminal to ask | add `--consent` once |
| `the gate failed` at ship | one of the checks above | each line says which, and what to run |
