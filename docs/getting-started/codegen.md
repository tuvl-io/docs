# Code generation

`tuvl codegen` writes the parts of a project that follow mechanically from its YAML, so you only
write the parts that need judgement. It is deterministic: no model is called, and **tuvl never
writes function bodies**.

```bash
tuvl codegen                  # all workflows
tuvl codegen triage_ticket    # one workflow's stubs, prompts and tests
tuvl codegen --check          # write nothing; exit 1 if anything would change (the CI gate)
```

## Building a whole spec with your coding agent

The commands above are the deterministic part. For an **approved** spec, `tuvl codegen --spec SPEC --all`
(or `--task 3`, `--task 1,3`) goes further: first, with no tokens spent, it writes the models from `# Data` and a
workflow skeleton of `pending` steps from `# Flows`, then it asks your installed coding agent to implement each
task on its own branch (`feature/TASK-…`), checks it (the step is implemented, `validate` and `spec verify`
agree, the Python passes `tuvl review`), and opens a draft pull request, stacked on the previous one. Nothing is
merged for you. See [Authoring with a coding agent](../internals/authoring.md).

## What it generates

| Output | Rule |
|---|---|
| `agents/_generated/schemas.py` | `<Id>In` / `<Id>Out` models per agent (per-signal variants and `<Id>Signal`), plus `<Workflow>Input` and `<Workflow>End`. Never hand-edited |
| `agents/<run>.py` | A stub for each `code` agent when missing; when present, a merge that refreshes the decorator, signature and docstring and **keeps your body** |
| `artifacts/<name>.md` | A prompt placeholder for an `artifact://` that an `llm` or `loop` agent references and that does not exist yet |
| `decide` agents | A block with neither rules nor a model gets one never-matching rule per enum value, each marked `# TODO` |
| `tests/<workflow>/<example>.yaml` | A test per `tuvl-example` block in the spec. Hand-written tests are never touched |

## The loop for a `code` agent

1. Declare the agent in the workflow YAML (or add a step in Insight): its `run`, `inputs`, `outputs`.
2. Run `tuvl codegen`. You get a typed stub:

    ```python title="agents/score_ticket.py"
    from __future__ import annotations

    from tuvl import Ctx, agent

    from agents._generated.schemas import ScoreTicketIn, ScoreTicketOut


    @agent("score_ticket")
    async def score_ticket(inp: ScoreTicketIn, ctx: Ctx) -> ScoreTicketOut:
        """Score how urgent a ticket is."""
        raise NotImplementedError("score_ticket")
    ```

3. Replace the `raise` with your logic. Everything above the body is owned by codegen.
4. Change the contract later (rename an input, add an output) and run `tuvl codegen` again: the
   signature and types update, and your body stays.

In Insight, choosing the `code` engine for an agent offers **⌘ Generate stub**, which runs the same
step, and saving the Python file normalizes the decorator and signature through codegen.

## Keeping it honest in CI

Generated files are committed, so a contract change that was not regenerated is a failing build:

```bash
tuvl codegen --check
```

It is one step of the [CI gate](../internals/spec-driven.md#7-the-ci-gate), alongside `tuvl validate
--strict`, `tuvl lock --check` and `tuvl test --strict`. Run `tuvl codegen` locally and commit the result.

## Notes

- **Don't edit `agents/_generated/`.** It is rewritten on every run.
- **One `@agent("run")` per contract.** If two agents share a `run` with different contracts,
  codegen warns and types the function as `Any`.
- **Coding agents** can run it through the dev MCP server: `codegen` (a dry run) always, and
  `codegen_write` with `--allow-write`. See [Build with Coding Agents](coding-agents.md).

## See also

- [Spec-driven development](../internals/spec-driven.md#5-codegen) — where codegen sits in the flow
- [Project structure](project-structure.md)
- [CLI reference](../internals/cli.md)
