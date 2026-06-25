# Testing Workflows

tuvl ships a built-in test framework for verifying that your workflow YAML files behave
correctly — without needing a live LLM, database, or external API.

The framework has two layers:

| Layer | What it does |
|-------|-------------|
| **Deterministic execution** | Runs the workflow graph with stub-injected data. No real network calls. |
| **LLM-as-a-Judge evaluation** | Sends the captured step traces to a judge model that checks each assertion in natural language. |

Both layers are controlled entirely by YAML test-case files that live alongside your
workflows.

---

## Quick Start

Generate sample test files with:

```bash
tuvl init --sample
```

This writes two ready-to-run test cases to `tests/workflows/`:

```
tests/workflows/
├── test_screen_candidate_pass.yaml    # happy path
└── test_screen_candidate_reject.yaml  # rejection branch
```

Run them (no judge LLM calls — just deterministic execution):

```bash
tuvl test
```

To also evaluate the captured traces with a judge LLM:

```bash
TUVL_TEST_JUDGE=gpt-4o tuvl test
```

---

## Test File Format

Each file in `tests/workflows/` is a **TestCase**:

```yaml title="tests/workflows/test_screen_candidate.yaml"
# Which Workflow (metadata.name) to exercise.
workflow: screen_candidate

# Initial context injected as the workflow's starting input.
input:
  name: "Alice Liddell"
  email: "alice@example.com"
  role: "Python Backend Engineer"
  experience_years: 4

# Stubs replace real step execution with deterministic mock output.
stubs:
  - step_id: evaluate_resume
    mock_output:
      evaluation: "Strong candidate with solid backend skills."
      recommendation: proceed

  - step_id: save_candidate
    mock_output:
      saved_candidate:
        id: "00000000-0000-0000-0000-000000000001"
        name: "Alice Liddell"
        status: screened
        score: 70.0

# Evaluations are LLM-as-a-Judge assertions.
evaluations:
  - step_id: compute_score
    instruction: >
      The score field must be a positive number between 0 and 100.
      A candidate with 4 years of experience and a "strong" evaluation
      should score at least 60.

  - step_id: respond
    instruction: >
      The response must include a candidate_id, name "Alice Liddell",
      status "screened", and recommendation "proceed". Score ≥ 60.
```

### Top-level fields

| Field | Required | Description |
|-------|----------|-------------|
| `workflow` | Yes | `metadata.name` of the Workflow to run |
| `input` | No | Initial context dict injected before the first step |
| `stubs` | No | List of step stubs (see below) |
| `evaluations` | Yes | List of LLM-as-a-Judge assertions (see below) |

---

## Stubs

A stub replaces a step's real execution with fixed output. The `mock_output` dict is
merged into the workflow context exactly as if the step had run normally.

```yaml
stubs:
  - step_id: fetch_job_market_data   # step to intercept
    mock_output:                     # data merged into context
      job_market: {}
      market_demand_score: 42
```

**Which steps to stub:**

| Step kind | Reason to stub |
|-----------|---------------|
| `Agent` | Avoid LLM API calls in CI; get deterministic output |
| `APICall` | Avoid external HTTP traffic |
| `MCP` | Avoid external MCP server dependency |
| `ModelOp` | Avoid database writes/reads |
| `HumanInTheLoop` | No reviewer available in CI |

Functional steps (pure Python `@node` functions) generally do _not_ need stubs unless
they have side effects.

!!! tip "Unstubbed HumanInTheLoop"
    If a `HumanInTheLoop` step has no stub, tuvl skips it silently and continues
    execution. The step still appears in the trace so you can assert on surrounding
    context.

### Stub fields

| Field | Required | Description |
|-------|----------|-------------|
| `step_id` | Yes | ID of the step to intercept (must exist in the workflow) |
| `mock_output` | Yes | Dict merged into context when this step is reached |

---

## Evaluations

An evaluation is a natural-language assertion evaluated by a judge LLM. The judge
receives the step's before/after context snapshot and your instruction, and returns a
`passed / failed` verdict with a one-sentence reason.

```yaml
evaluations:
  - step_id: compute_score
    instruction: >
      The score field must be a positive number between 0 and 100.
    judge_model: openai/gpt-4o-mini   # optional — overrides persisted config and env var
```

### Evaluation fields

| Field | Required | Description |
|-------|----------|--------------|
| `step_id` | Yes | ID of the step to evaluate (must appear in the trace) |
| `instruction` | Yes | Natural-language condition the step output must satisfy |
| `judge_model` | No | litellm model string for this evaluation only. See resolution order below. |

### Judge model resolution order

For each evaluation tuvl resolves the judge model using the following priority (first
non-empty value wins):

1. **`judge_model` field on the evaluation** — highest priority, per-assertion override
2. **`TUVL_TEST_JUDGE` environment variable** — process-level default
3. **`.tuvl/testing.yaml` persisted config** — written by the Dev UI (Settings → Testing → LLM Judge)

If none of the three provides a model the evaluation is **silently skipped** and the
run exits `0`. No LLM API call is made.

The judge model string follows litellm conventions, e.g. `openai/gpt-4o`,
`anthropic/claude-3-5-sonnet-20241022`, `ollama/llama3`.

### Private-key sanitization

Before sending context snapshots to the judge, tuvl automatically strips any key whose
name starts with `_` (underscore). These are treated as internal / private fields and
should never be exposed to an external LLM.

The original `step_trace` dict passed by the caller is **not mutated** — a deep copy is
made before sanitization.

---

## `tuvl test` Command

```bash
tuvl test [OPTIONS]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--project-dir`, `-d` | `.` | Project root |
| `--tests-dir` | `tests/workflows/` | Directory containing `*.yaml` test files |

### How it works

1. Discovers all `*.yaml` files in `tests/workflows/` (or `--tests-dir`)
2. For each file, parses the `TestCase` schema
3. Looks up the named workflow in `workflows/`
4. Runs `WorkflowTestRunner` — the real workflow engine with stub injection enabled
5. Collects a full step trace (before/after context snapshots per step)
6. If `TUVL_TEST_JUDGE` is set, sends each step trace + evaluation instruction to the
   judge model and prints a pass/fail verdict
7. Exits with code `0` if all evaluations passed, `1` if any failed

### Terminal output

```
━━━━━━━━━━━━━  tuvl test  ━━━━━━━━━━━━━
  test_screen_candidate_pass
  test_screen_candidate_reject

 Running tests…
  test_screen_candidate_pass
  ✔  compute_score: score is 70.0, which is ≥ 60 as required.
  ✔  respond: all required fields present with correct values.

  test_screen_candidate_reject
  ✔  mark_rejected: status=rejected, score=0 as expected.
  ✔  respond_reject: rejection response fields correct.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  4 / 4 passed
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TUVL_TEST_JUDGE` | litellm model string used as the default judge (priority 2 of 3). Example: `openai/gpt-4o`. If not set and no persisted config exists, evaluations that don't specify `judge_model` are skipped. |

!!! tip "Persistent config"
    Use the Dev UI (**Settings → Testing → LLM Judge**) to persist a default judge model
    to `.tuvl/testing.yaml` without needing an environment variable. The env var always
    overrides the persisted config at runtime.

---

## Writing Effective Test Instructions

The judge model reads the full before/after context snapshot alongside your instruction.
These patterns work well:

```yaml
# ✅ Reference specific context keys and expected values
instruction: >
  The score field must be between 60 and 100.
  The recommendation must be "proceed".

# ✅ Describe transformations
instruction: >
  The status field must have changed from "new" to "screened".

# ✅ Assert on structure
instruction: >
  saved_candidate must be a dict with keys: id, name, email, status, score.

# ❌ Too vague — the judge cannot verify this reliably
instruction: The output should be reasonable.
```

---

## Running in CI

```yaml title=".github/workflows/test.yml"
- name: Run tuvl workflow tests
  env:
    TUVL_TEST_JUDGE: gpt-4o
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    uv run tuvl test --project-dir .
```

If `TUVL_TEST_JUDGE` is not set, `tuvl test` still runs the deterministic layer
(stub execution + routing checks) and exits `0` on success. This is safe to run in
CI without any LLM credentials.
