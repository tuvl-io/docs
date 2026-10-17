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
  model: gemini/gemini-3.1-flash-lite     # a provider/model id
  api_key: ${GEMINI_API_KEY}             # optional; read from the environment
  temperature: 0.2
  max_tokens: 2048
  timeout: 60
```

| Property | Description |
|---|---|
| `model` | Model id: `provider/model` (required) — see [Models and Providers](../internals/models.md) |
| `api_base` | Endpoint, for Ollama, a gateway or any OpenAI-compatible server |
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
| Azure OpenAI | `azure/<deployment>` with `AZURE_OPENAI_ENDPOINT` or `api_base` |
| Amazon Bedrock | `bedrock/<model id>` with `AWS_BEARER_TOKEN_BEDROCK` and `AWS_REGION` |
| Vertex AI | `vertex_ai/google/<model>` with `VERTEX_ACCESS_TOKEN` and `GOOGLE_CLOUD_PROJECT` |
| Cohere, Groq, Mistral, DeepSeek, xAI | `cohere/…`, `groq/…`, `mistral/…`, `deepseek/…`, `xai/…` |
| LiteLLM proxy or other gateway | `litellm_proxy/<alias>` with `api_base` and `api_key` |

tuvl calls these with its own HTTP client; nothing else is installed. Providers, key variables and
caveats: [Models and Providers](../internals/models.md).

## Decision models

```yaml title="llms/triage-classifier.yaml"
kind: AgentModel
metadata: { name: triage-classifier }
spec:
  type: decision
  provider: llm                # laya | jev | llm
  model: gemini/gemini-3.1-flash-lite
```

A decision model picks one value of a `decide` agent's enum output with a confidence; it never writes
free text.

**Laya (self-hosted).** `tuvl init --decision-model laya` writes this model, `LAYA_API_*` entries in
`.env`, and a `compose.yaml` that runs the laya-serve container on `localhost:8000`
(`docker compose up -d laya`). `tuvl ship` adds Laya to the Helm chart
([Shipping to production](../getting-started/shipping.md)).

The [`tuvl/laya-serve`](https://hub.docker.com/r/tuvl/laya-serve) image comes in two variants:

| Tag | Checkpoints | Memory | Use with |
|---|---|---|---|
| `<version>-en` | english | about 2 GiB | `model: english` |
| `<version>` | english + multilingual | about 3.5 GiB | `model: auto` or `multilingual` |

`tuvl init` scaffolds `model: english` with the `-en` image, and `tuvl ship` picks the image (and the
Helm memory requests) that matches the model. An `-en` image has no multilingual weights and runs
offline, so non-English text sent to it fails with HTTP 500 `inference failed` — set `model: auto`
and use the full image when you need other languages.

```yaml title="llms/laya.yaml"
kind: AgentModel
metadata: { name: laya }
spec:
  type: decision
  provider: laya
  model: english               # english | auto | multilingual | typed-decisions
  api_base: ${LAYA_API_BASE:http://localhost:8000}
  api_key: ${LAYA_API_KEY:}    # optional; an ${ENV_VAR} reference, never a literal key
```

**Jev (hosted).** `provider: jev` with its `api_base`, and `model` pinned to a version (`jev-1.13.0`).

**OpenAI-compatible endpoints** (a LiteLLM proxy, your own classifier) use `provider: llm` with
`model: openai/<name>`, `api_base` and an `${ENV_VAR}` `api_key`. The endpoint must return
`{"decision": …, "confidence": 0..1}` (or token logprobs); an answer with no confidence is an error,
never treated as certain.

See [Decide](../internals/decide.md).

## Where models are used

| Site | Field |
|---|---|
| `llm` agent | `llm.model: default` (or a provider/model id directly) |
| `loop` agent | `loop.model` |
| `decide` agent | `decide.model.ref` — a decision model or an `llm` model |
| Judge artifact | `spec.model` |

Model ids are pinned in `tuvl.lock` by `tuvl lock`. You can also manage models on the Insight
**AI Models** page.
