# Agent Configuration

Agents define LLM providers and their settings for AI-powered workflow steps.

## Basic Configuration

```yaml title="agents/default.yaml"
kind: "AgentModel"
version: "v1"
metadata:
  name: "default"
spec:
  provider: "ollama"
  model: "llama3"
  api_base: "http://localhost:11434"
  temperature: 0.7
  max_tokens: 1024
```

## Provider Configurations

### Ollama (Local)

```yaml
kind: "AgentModel"
version: "v1"
metadata:
  name: "local"
spec:
  provider: "ollama"
  model: "llama3"
  api_base: "http://localhost:11434"
  temperature: 0.7
  max_tokens: 2048
```

Environment setup:

```env
# .env
LITELLM_OLLAMA_BASE_URL=http://localhost:11434
```

### OpenAI

```yaml
kind: "AgentModel"
version: "v1"
metadata:
  name: "openai"
spec:
  provider: "openai"
  model: "gpt-4o"
  api_key: "${OPENAI_API_KEY}"
  temperature: 0.7
  max_tokens: 4096
```

Environment setup:

```env
# .env
OPENAI_API_KEY=sk-...
```

### Anthropic

```yaml
kind: "AgentModel"
version: "v1"
metadata:
  name: "claude"
spec:
  provider: "anthropic"
  model: "claude-3-5-sonnet-20241022"
  api_key: "${ANTHROPIC_API_KEY}"
  temperature: 0.7
  max_tokens: 4096
```

Environment setup:

```env
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

### LiteLLM Proxy

For routing through a LiteLLM proxy:

```yaml
kind: "AgentModel"
version: "v1"
metadata:
  name: "proxy"
spec:
  provider: "litellm"
  model: "gpt-4"                    # Model name configured in LiteLLM
  api_base: "${LITELLM_PROXY_URL}"
  api_key: "${LITELLM_MASTER_KEY}"
```

## Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `provider` | string | Yes | Provider name: `ollama`, `openai`, `anthropic`, `litellm` |
| `model` | string | Yes | Model identifier |
| `api_base` | string | For ollama/litellm | API endpoint URL |
| `api_key` | string | For openai/anthropic | API authentication key |
| `temperature` | float | No | Randomness (0.0-2.0, default: 0.7) |
| `max_tokens` | integer | No | Maximum response length |
| `top_p` | float | No | Nucleus sampling (0.0-1.0) |
| `timeout` | integer | No | Request timeout in seconds |

## Using Agents in Workflows

Reference the agent model or specify inline:

### Using Agent Preset

```yaml
- id: "classify"
  kind: "Agent"
  mode: "completion"
  agent:
    model: "default"    # Uses agents/default.yaml
    prompt: "..."
```

### Inline Model Specification

```yaml
- id: "classify"
  kind: "Agent"
  mode: "completion"
  agent:
    model: "ollama/llama3"    # LiteLLM format
    prompt: "..."
```

### LiteLLM Model Strings

tuvl uses LiteLLM format for model identifiers:

| Provider | Format | Example |
|----------|--------|---------|
| Ollama | `ollama/{model}` | `ollama/llama3` |
| OpenAI | `openai/{model}` | `openai/gpt-4o` |
| Anthropic | `anthropic/{model}` | `anthropic/claude-3-5-sonnet-20241022` |
| Azure | `azure/{deployment}` | `azure/gpt-4-deployment` |

## Agent Step Configuration

Every `Agent` step declares a `mode:` — `completion` for a single retried call, `autonomous` for a bounded tool loop (next section). Full completion-mode specification:

```yaml
- id: "analyze"
  kind: "Agent"
  mode: "completion"
  agent:
    model: "ollama/llama3"

    # Prompts — inline text or artifact://<prompt artifact>
    system: |
      You are a helpful assistant that analyzes data.
      Always respond with valid JSON.

    prompt: |
      Analyze this customer:
      Name: {{ name }}
      Company: {{ company }}

      Return JSON: {"score": 1-100, "tags": ["tag1", "tag2"]}

    # Outcome handling (unified contract, both modes)
    outcome:
      format: json              # json | text
      map:
        score: customer_score   # Rename LLM keys in context
        tags: customer_tags
      # enum: [approve, reject] # optional closed signal set — the returned
      #                         # "outcome" field routes the workflow
      # write: analyze_result   # optional key capturing the full payload

    # Error handling
    retry:
      attempts: 3
      on: [parse_error, timeout, rate_limit]
      backoff: 2
    
    timeout: 30
```

## Autonomous Agent Step Configuration

An `Agent` step with `mode: autonomous` reuses the same `agent:` model configuration but runs a **bounded tool-calling loop** instead of a single completion. The model is given its `steering` and a closed set of `tools` (each referencing another step in the workflow), and keeps calling them until it emits one of `outcome.enum`. The loop is capped by `max_iterations` and an optional `token_budget`.

```yaml
- id: "triage"
  kind: "Agent"
  mode: "autonomous"
  agent:
    model: "default"                 # same presets / LiteLLM strings as completion mode
    steering: "Resolve the support ticket using the available tools."
    max_iterations: 8                # hard cap on loop turns (default 8)
    token_budget: 50000              # optional cap on cumulative tokens
    skills:                          # when-relevant capabilities — inline text or artifact refs
      - "artifact://support-policy"
    tools:                           # REQUIRED in this mode
      - ref: "lookup_order"          # the id of another step in this workflow;
                                     # description comes from that step's own description:
        parameters:                  # JSON Schema for the tool's arguments
          type: object
          properties: { order_id: { type: string } }
          required: [order_id]
        writes_context: false        # default: tool result returns to the agent only
      - ref: "issue_refund"
    outcome:
      enum: ["resolved", "escalate", "needs_human"]   # closed set of exits
      write: "agent_result"          # context key receiving the final payload
  routes:
    resolved:        "format_reply"
    escalate:        "notify_manager"
    needs_human:     "hitl_review"
    max_iterations:  "fallback_summary"   # reserved abnormal exits — map these too
    budget_exceeded: "fallback_summary"
    error:           "alert_ops"
    aborted:         "alert_ops"
```

| Property | Default | Description |
|----------|---------|-------------|
| `steering` | Required | The agent's persistent instruction, always injected — inline text or `artifact://<steering artifact>` |
| `skills` | `[]` | When-relevant capabilities — inline text or `artifact://<skill artifact>` refs |
| `tools` | Required | Tools the agent may call; each `ref` names another step (`APICall` / `MCP` / `ModelOp` / `Functional`) with JSON-Schema `parameters`. The tool description is sourced from the referenced step's own `description:` (required); a `description` here is only a fallback |
| `tools[].writes_context` | `false` | When `true`, the tool's public output merges back into the shared context |
| `guardrails` | none | `input` / `output` / `tools` gates backed by `type: guardrail` artifacts — see [Guardrails](../internals/tuvl-agentic-manual.md#415-guardrails-type-guardrail-artifacts) |
| `outcome.enum` | `[]` | Closed set of exit signals — **every value must be mapped in `routes:`** |
| `outcome.write` | `<id>_result` | Context key that receives the agent's final result payload |
| `max_iterations` | `8` | Hard cap on loop turns |
| `token_budget` | `null` | Optional hard cap on cumulative tokens |

!!! warning "Bound the loop and route every exit"
    Map every `outcome.enum` value **and** the reserved abnormal exits `max_iterations`, `budget_exceeded`, `error`, `aborted` (emitted when a supervisor/operator breaks the run), and `guardrail_violation` (when guardrails are attached) in `routes:`. For data-driven branching after an outcome (by country, tier, region…), route into a [`Router` with `match:`](../concepts/workflows.md#router-steps) — never push deterministic logic into the model. See [Workflows → Autonomous Agent Steps](../concepts/workflows.md#autonomous-agent-steps) for the complete reference.

## Supervising an Autonomous Agent

An optional per-workflow **`spec.supervisor`** block watches this workflow's
autonomous-mode `Agent` runs **live** and can **pause, steer, or abort** them mid-loop
(at the cooperative iteration boundary — never mid-call). It is authored in-band
(a sibling of `steps:`, **not** a step) and executed out-of-band as a concurrent
watcher for each run.

```yaml
spec:
  # context / trigger / steps ...
  supervisor:
    model: default              # omit → rule-only; set → LLM supervisor
    watches: [agents]           # monitor autonomous Agent iterations (default)
    criteria: |                 # natural-language policy for the LLM path
      Abort if the agent calls the same tool 3× with no new information,
      or drifts away from the user's actual request.
    # criteria: artifact://escalation-policy
    #                            ↑ alternative to inline text — a steering artifact ref
    on_violation: pause         # abort | pause | steer   (default action)
    every_n_iterations: 2       # LLM cost gate (rules below run every turn)
    steer_message: |            # sent when the action is `steer` (rules path)
      Refocus on the task; stop repeating actions that add no new information.
    rules:                      # cheap deterministic pre-filters (no LLM)
      - { when: tool_repeated,    count: 3, then: pause }
      - { when: budget_fraction,  gt: 0.8,  then: steer }
      - { when: iteration_reached, gte: 12, then: abort }
```

| Field | Description |
|-------|-------------|
| `model` + `criteria` | Enable the LLM supervisor — judged every `every_n_iterations` turns; a fail verdict applies `on_violation` with the reason surfaced (and used as the steer message) |
| `criteria` | Inline policy text **or** an `artifact://` ref to a `type: steering` artifact (resolved per judge pass, so dev-mode `.md` edits apply live). The old `criteria_file` field was removed — `tuvl validate` rejects it |
| `rules` | Deterministic checks run **every** turn: `tool_repeated {tool?, count}`, `budget_fraction {gt}`, `iteration_reached {gte}`. Each rule's `then` overrides `on_violation` |
| `on_violation` | Default action when a check fails: `abort` \| `pause` \| `steer` |
| `every_n_iterations` | Cost gate for the LLM path (default 1) |
| `steer_message` | Message injected on a `steer` action from a **rule** (the LLM path uses the verdict's reason instead) |
| `watches` | `[agents]` (default) monitors autonomous `Agent` iterations |

`abort` exits the agent via the reserved **`aborted`** signal — map it in the
step's `routes:` for a specific downstream path (otherwise it routes as `error`).

### Authoring it visually in Insight

You don't have to hand-write the block. In the Insight workflow canvas the
supervisor is a first-class **off-spine node**: add **Supervisor** from the node
palette (one per workflow) and it attaches as a watcher — no flow edges, since it
observes rather than runs in the sequence. Double-click it to configure inline:

- **Judge model** — a dropdown of your configured models (blank = rule-only)
- **Criteria** — inline natural-language policy, or an `artifact://` reference to
  a `type: steering` artifact
- **On violation** (pause / steer / abort), **Judge every N iterations**, and the
  **Rules** JSON

Every field is written straight into `spec.supervisor` in the workflow YAML, and
the block round-trips back onto the node when you reopen the workflow.

Operators can also observe and control runs live from the Insight **Agents**
dashboard or the API — `GET /api/agents/runs`, `POST /api/agents/runs/{id}/{abort,pause,resume,steer}`
(scopes `agent:observe` / `agent:control`). Supervision is optional and additive:
no `spec.supervisor` means no watcher and zero cost.

## Outcome Formats

### JSON Format

```yaml
agent:
  prompt: 'Return JSON: {"decision": "approve" | "reject"}'
  outcome:
    format: json
    map:
      decision: approval_decision
```

The LLM response is parsed as JSON; all fields merge into context, with `map` as a rename layer.

### Text Format

```yaml
agent:
  prompt: "Summarize this document in one paragraph."
  outcome:
    format: text
    write: summary
```

The trimmed raw text response is stored at the `write` key.

### Routing by Outcome

```yaml
agent:
  prompt: "Decide what to do with the request."
  outcome:
    format: json
    enum: [approve, reject, review]
```

With `enum` declared, the model returns an `"outcome"` field validated against the closed set — that value becomes the routing signal, and every enum value must be mapped in `routes:`. An arbitrary LLM string can never route the workflow.

## Retry Configuration

Handle transient errors with retries:

```yaml
agent:
  retry:
    attempts: 3        # Total attempts (including first)
    on:                # Error types to retry
      - parse_error    # JSON parsing failed
      - timeout        # Request timed out
      - rate_limit     # Rate limit exceeded
      - server_error   # 5xx response
    backoff: 2         # Exponential backoff multiplier
```

With `backoff: 2`:

- Attempt 1: Immediate
- Attempt 2: Wait 2 seconds
- Attempt 3: Wait 4 seconds

## Multiple Agent Presets

Define different presets for different use cases:

```yaml title="agents/fast.yaml"
kind: "AgentModel"
version: "v1"
metadata:
  name: "fast"
spec:
  provider: "ollama"
  model: "mistral"
  temperature: 0.3
  max_tokens: 512
```

```yaml title="agents/creative.yaml"
kind: "AgentModel"
version: "v1"
metadata:
  name: "creative"
spec:
  provider: "openai"
  model: "gpt-4o"
  temperature: 0.9
  max_tokens: 2048
```

Use in workflows:

```yaml
- id: "quick_check"
  agent:
    model: "fast"
    prompt: "..."

- id: "write_copy"
  agent:
    model: "creative"
    prompt: "..."
```

## Best Practices

### 1. Use Presets for Common Configs

```yaml
# Define once
# agents/default.yaml
spec:
  provider: "ollama"
  model: "llama3"
  temperature: 0.7

# Use everywhere
agent:
  model: "default"
```

### 2. Keep API Keys in Environment

```yaml
# Good
api_key: "${OPENAI_API_KEY}"

# Never do this
api_key: "sk-actual-key-here"
```

### 3. Set Appropriate Timeouts

```yaml
# Short for simple tasks
timeout: 15

# Longer for complex analysis
timeout: 60
```

### 4. Use Structured Output

```yaml
# Good - clear JSON structure
prompt: |
  Return JSON: {"category": "A" | "B" | "C"}

# Harder to parse
prompt: |
  What category is this?
```

### 5. Handle All Outcomes

```yaml
agent:
  outcome:
    enum: [approve, reject]
routes:
  approve: "process"
  reject: "notify"
  error: "manual_review"  # Always handle errors
```

## Troubleshooting

### Connection Refused (Ollama)

```
Connection refused: http://localhost:11434
```

- Ensure Ollama is running: `ollama serve`
- Check the port: `curl http://localhost:11434/api/version`

### Invalid API Key

```
AuthenticationError: Invalid API key
```

- Verify the key in your `.env` file
- Check for extra whitespace or newlines
- Ensure the key has proper permissions

### Rate Limiting

```
RateLimitError: Rate limit exceeded
```

- Add retry configuration with backoff
- Consider using multiple API keys
- Implement request queuing

### JSON Parse Errors

```
JSONDecodeError: Extra data
```

- Improve prompts to request clean JSON
- Add `"Return ONLY valid JSON"` to system prompt
- Use retry with `parse_error` handling

## Next Steps

- [Workflows](../concepts/workflows.md) — Using agents in workflows
- [Nodes](../concepts/nodes.md) — Combining agents with code
- [Examples](../examples/candidate-onboarding.md) — Complete examples
