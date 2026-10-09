# AI Models

An `AgentModel` (in `llms/`) names a model so workflows can refer to it. There are two types:
**`llm`** (the default) for `llm` and `loop` agents, judges and spec analysis, and **`decision`** for
the `decide` engine. `tuvl init --preset gemini|openai|anthropic|ollama` writes `llms/default.yaml`
and `llms/analysis.yaml` for you.

## LLM models

```yaml title="llms/default.yaml"
kind: AgentModel
version: v1
metadata:
  name: default
spec:
  model: gemini/gemini-3.1-flash-lite     # a LiteLLM model id
  api_key: ${GEMINI_API_KEY}             # optional; read from the environment
  temperature: 0.2
  max_tokens: 2048
  timeout: 60
```

| Property | Description |
|---|---|
| `model` | LiteLLM model id: `provider/model` (required) |
| `api_base` | Endpoint, for Ollama or a LiteLLM proxy |
| `api_key` | Use `${ENV_VAR}` — secrets live in `.env`, never in YAML. Without it, the provider's standard variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, …) is used |
| `temperature`, `max_tokens` | Defaults for calls through this model (an agent's `budget.max_tokens` still bounds it) |
| `timeout` | Request timeout in seconds (default 60) |
| `enabled` | `false` disables the model; agents that use it fail loudly instead of falling back |

| Provider | Example `model` |
|---|---|
| Ollama (local) | `ollama/llama3.1` with `api_base: http://localhost:11434` |
| OpenAI | `openai/gpt-5.4-mini` |
| Anthropic | `anthropic/claude-haiku-4-5` |
| Gemini | `gemini/gemini-3.1-flash-lite` |
| LiteLLM proxy | `litellm_proxy/<name>` with `api_base` and `api_key` |

## Decision models

```yaml title="llms/triage-classifier.yaml"
kind: AgentModel
metadata: { name: triage-classifier }
spec:
  type: decision
  provider: litellm            # laya | jev | litellm
  model: gemini/gemini-2.5-flash
```

A decision model picks one value of a `decide` agent's enum output with a confidence; it never writes
free text. `laya` needs the `tuvl[laya]` extra; `jev` must be pinned to a version. See
[Decide](../internals/decide.md).

## Where models are used

| Site | Field |
|---|---|
| `llm` agent | `llm.model: default` (or a LiteLLM id directly) |
| `loop` agent | `loop.model` |
| `decide` agent | `decide.model.ref` — a decision model or an `llm` model |
| Judge artifact | `spec.model` |
| Spec analysis | `config.yaml` → `spec.analysis_model`, or `tuvl spec analyse --model` |

Model ids are pinned in `tuvl.lock` by `tuvl lock`. You can also manage models on the Insight
**AI Models** page.
