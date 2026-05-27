# LLM Judge

tuvl ships a built-in **LLM-as-a-Judge** evaluator that checks step outputs against
natural-language assertions. It is used by both the `tuvl test` command and the
**Evaluate tab** in the Spectrum dev UI.

The judge model is resolved at evaluation time — no model is required to run deterministic
tests or execute workflows. If no model is configured, evaluations are silently **skipped**
rather than failing, so CI never breaks due to a missing LLM key.

---

## Resolution Order

For every evaluation, tuvl resolves the judge model using the following priority
(first non-empty value wins):

| Priority | Source | How to set |
|----------|--------|-----------|
| 1 (highest) | **Per-evaluation `judge_model`** in the YAML test case | `evaluations[].judge_model` field |
| 2 | **`TUVL_TEST_JUDGE` environment variable** | export / `.env` file |
| 3 (lowest) | **`.tuvl/testing.yaml` persisted config** | Dev UI or file edit |

If none of the three provides a model the evaluation returns `passed: false` with a
`[SKIPPED]` reason and no LLM API call is made.

---

## Persisted Config

The recommended way to set a project-wide default judge is the Dev UI panel.  It writes
to `.tuvl/testing.yaml` in your project root so the setting is committed to source
control and shared across the team.

### Config file

```yaml title=".tuvl/testing.yaml"
kind: LLMJudgeConfig
version: v1
metadata:
  name: default
spec:
  judge_model: openai/gpt-4o-mini
```

The `judge_model` value is any [litellm model string](https://docs.litellm.ai/docs/providers),
for example:

| Provider | Model string |
|----------|-------------|
| OpenAI | `openai/gpt-4o`, `openai/gpt-4o-mini` |
| Anthropic | `anthropic/claude-3-5-sonnet-20241022`, `anthropic/claude-3-haiku-20240307` |
| Ollama (local) | `ollama/llama3`, `ollama/mistral` |
| Groq | `groq/llama-3.1-70b-versatile` |
| Google | `gemini/gemini-1.5-flash` |

Leave `judge_model` empty (or omit the file entirely) to disable the default and rely on
per-evaluation overrides or the `TUVL_TEST_JUDGE` env var.

### Dev UI

The config file can be edited without touching the filesystem directly:

**Settings → Testing → LLM Judge**

The panel shows:

- A **dropdown** populated from all AI Models you have configured in **Settings → AI Models**
  (saved under `llms/` in your project). Select `— none —` to clear the default.
- A read-only **YAML preview** reflecting the current form state.
- A **status badge** — *Configured* (emerald) when a model is set, *Not configured* (slate)
  when the field is empty.

Changes are saved immediately and take effect on the next `tuvl test` run or Spectrum
evaluate call without restarting the engine.

---

## Environment Variable

```bash
export TUVL_TEST_JUDGE=openai/gpt-4o
```

The env var overrides `.tuvl/testing.yaml` at runtime. Useful for CI pipelines where you
want to inject the model via secrets without committing a model string to source control.

```yaml title=".github/workflows/test.yml"
- name: Run tuvl workflow tests
  env:
    TUVL_TEST_JUDGE: openai/gpt-4o
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: uv run tuvl test --project-dir .
```

---

## Private-Key Sanitization

Before sending any context snapshot to the judge LLM, tuvl automatically strips all keys
whose names start with `_` (underscore). These are treated as internal implementation
details that should never be exposed to an external model.

```python
# These are sent to the judge:
{"score": 72.0, "recommendation": "proceed"}

# These are stripped automatically:
{"_route": "fast_track", "_trace_id": "abc123"}
```

The caller's original dict is never mutated — a deep copy is made before sanitization.

---

## Using the Evaluate Tab in Spectrum

The Spectrum dev UI exposes an ad-hoc evaluation panel without requiring a test YAML file.

1. Run a workflow trace in **Spectrum** (`/insight` → Spectrum).
2. Click any completed step node.
3. Select the **Evaluate** tab in the detail panel.
4. Type an **evaluation instruction** and optionally select a **judge model override**
   from the dropdown.
5. Click **Run Evaluation** — the verdict appears immediately below.

See [Spectrum — Evaluate Tab](../tools/spectrum.md#llm-as-a-judge--evaluate-tab) for full details.

---

## gRPC API

The judge config is exposed via three `DevService` RPCs (dev mode only):

```proto
rpc GetTestingConfig  (DevEmpty)             returns (TestingConfigResponse);
rpc SaveTestingConfig (SaveTestingConfigReq) returns (DevMutateResult);
rpc EvaluateTrace     (EvaluateTraceReq)     returns (EvaluateTraceResponse);
```

A REST shim is available at:

- `GET /dev/testing-config` — returns `{ spec: { judge_model } }` or 404
- `PUT /dev/testing-config` — body `{ spec: { judge_model } }`
- `POST /dev/evaluate-trace` — body `{ step_id, instruction, step_trace, judge_model? }`

All dev endpoints require the `x-dev-key` header (value: `TUVL_DEV_API_KEY`).
