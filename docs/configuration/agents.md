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
  agent:
    model: "default"    # Uses agents/default.yaml
    prompt: "..."
```

### Inline Model Specification

```yaml
- id: "classify"
  kind: "Agent"
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

Full agent step specification:

```yaml
- id: "analyze"
  kind: "Agent"
  agent:
    model: "ollama/llama3"
    
    # Prompts
    system: |
      You are a helpful assistant that analyzes data.
      Always respond with valid JSON.
    
    prompt: |
      Analyze this customer:
      Name: {{ name }}
      Company: {{ company }}
      
      Return JSON: {"score": 1-100, "tags": ["tag1", "tag2"]}
    
    # Output handling
    output:
      format: json              # json | text | signal
      map:
        score: customer_score   # Map LLM keys to context
        tags: customer_tags
      signal_from: score        # Use for routing
    
    # Error handling
    retry:
      attempts: 3
      on: [parse_error, timeout, rate_limit]
      backoff: 2
    
    timeout: 30
```

## Autonomous Agent Step Configuration

An `AutonomousAgent` step reuses the same `agent:` model configuration but runs a **bounded tool-calling loop** instead of a single completion. The model is given its `steering` and a closed set of `tools` (each referencing another step in the workflow), and keeps calling them until it emits one of `outcome.enum`. The loop is capped by `max_iterations` and an optional `token_budget`.

```yaml
- id: "triage"
  kind: "AutonomousAgent"
  agent:
    model: "default"                 # same presets / LiteLLM strings as Agent
    steering: "Resolve the support ticket using the available tools."
    max_iterations: 8                # hard cap on loop turns (default 8)
    token_budget: 50000              # optional cap on cumulative tokens
    skills:                          # project-relative .md files injected into the system prompt
      - ".agents/skills/support-policy.md"
    tools:
      - ref: "lookup_order"          # the id of another step in this workflow
        description: "Fetch order details by order id."   # optional — overrides lookup_order's own description:
        parameters:                  # JSON Schema for the tool's arguments
          type: object
          properties: { order_id: { type: string } }
          required: [order_id]
        writes_context: false        # default: tool result returns to the agent only
      - ref: "issue_refund"          # description defaults to issue_refund's top-level description:
    outcome:
      enum: ["resolved", "escalate", "needs_human"]   # closed set of exits
      output_key: "agent_result"     # context key receiving the final output
  routes:
    resolved:        "format_reply"
    escalate:        "notify_manager"
    needs_human:     "hitl_review"
    max_iterations:  "fallback_summary"   # reserved abnormal exits — map these too
    budget_exceeded: "fallback_summary"
    error:           "alert_ops"
```

| Property | Default | Description |
|----------|---------|-------------|
| `steering` | Required | The agent's persistent instruction, always injected |
| `steering_files` | `[]` | Per-agent `.md` files (**always** injected), scoped to `agents/<workflow>__<stepId>/steering/` |
| `skills` | `[]` | Per-agent `.md` files injected **when relevant**, scoped to `agents/<workflow>__<stepId>/skills/`. Scoping means same-named files never collide across agents, and an agent can only read its own |
| `tools` | `[]` | Tools the agent may call; each `ref` names another step (`APICall` / `MCP` / `ModelOp` / `Functional`) with JSON-Schema `parameters`. The tool description defaults to the referenced step's top-level `description:`; `description` here is an optional override |
| `tools[].writes_context` | `false` | When `true`, the tool's public output merges back into the shared context |
| `outcome.enum` | `[]` | Closed set of exit signals — **every value must be mapped in `routes:`** |
| `outcome.output_key` | `<id>_result` | Context key that receives the agent's final output |
| `max_iterations` | `8` | Hard cap on loop turns |
| `token_budget` | `null` | Optional hard cap on cumulative tokens |

!!! warning "Bound the loop and route every exit"
    Map every `outcome.enum` value **and** the reserved abnormal exits `max_iterations`, `budget_exceeded`, `error`, and `aborted` (emitted when a supervisor/operator breaks the run) in `routes:`. For data-driven branching after an outcome (by country, tier, region…), route into a [`Router` with `match:`](../concepts/workflows.md#router-steps) — never push deterministic logic into the model. See [Workflows → Autonomous Agent Steps](../concepts/workflows.md#autonomous-agent-steps) for the complete reference.

## Supervising an Autonomous Agent

An optional per-workflow **`spec.supervisor`** block watches this workflow's
`AutonomousAgent` runs **live** and can **pause, steer, or abort** them mid-loop
(at the cooperative iteration boundary — never mid-call). It is authored in-band
(a sibling of `steps:`, **not** a step) and executed out-of-band as a concurrent
watcher for each run.

```yaml
spec:
  # context / trigger / steps ...
  supervisor:
    model: default              # omit → rule-only; set → LLM supervisor
    watches: [agents]           # monitor AutonomousAgent iterations (default)
    criteria: |                 # natural-language policy for the LLM path
      Abort if the agent calls the same tool 3× with no new information,
      or drifts away from the user's actual request.
    on_violation: pause         # abort | pause | steer   (default action)
    every_n_iterations: 2       # LLM cost gate (rules below run every turn)
    rules:                      # cheap deterministic pre-filters (no LLM)
      - { when: tool_repeated,    count: 3, then: pause }
      - { when: budget_fraction,  gt: 0.8,  then: steer }
      - { when: iteration_reached, gte: 12, then: abort }
```

| Field | Description |
|-------|-------------|
| `model` + `criteria` | Enable the LLM supervisor — judged every `every_n_iterations` turns; a fail verdict applies `on_violation` with the reason surfaced (and used as the steer message) |
| `rules` | Deterministic checks run **every** turn: `tool_repeated {tool?, count}`, `budget_fraction {gt}`, `iteration_reached {gte}`. Each rule's `then` overrides `on_violation` |
| `on_violation` | Default action when a check fails: `abort` \| `pause` \| `steer` |
| `every_n_iterations` | Cost gate for the LLM path (default 1) |
| `watches` | `[agents]` (default) monitors AutonomousAgent iterations |

`abort` exits the agent via the reserved **`aborted`** signal — map it in the
step's `routes:` for a specific downstream path (otherwise it routes as `error`).

Operators can also observe and control runs live from the Insight **Agents**
dashboard or the API — `GET /api/agents/runs`, `POST /api/agents/runs/{id}/{abort,pause,resume,steer}`
(scopes `agent:observe` / `agent:control`). Supervision is optional and additive:
no `spec.supervisor` means no watcher and zero cost.

## Output Formats

### JSON Format

```yaml
agent:
  prompt: 'Return JSON: {"decision": "approve" | "reject"}'
  output:
    format: json
    map:
      decision: approval_decision
```

The LLM response is parsed as JSON and mapped to context keys.

### Text Format

```yaml
agent:
  prompt: "Summarize this document in one paragraph."
  output:
    format: text
    map:
      response: summary
```

Raw text response is stored in the specified key.

### Signal Format

```yaml
agent:
  prompt: "Respond with one word: approve, reject, or review"
  output:
    format: signal
```

The response is used directly as the routing signal.

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
  output:
    signal_from: decision
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
