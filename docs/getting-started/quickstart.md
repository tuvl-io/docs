# Quickstart

This walks through the sample project: a support-ticket triage workflow with a spec, a task plan,
tests and a lock that pass the CI gate as created.

## 1. Create the project

```bash
tuvl init triage --sample --preset gemini -y      # or openai | anthropic | ollama
cd triage
```

The preset writes `llms/default.yaml` (the agents' model) and `llms/analysis.yaml` (spec analysis)
and reads the API key from your environment into `.env`. Point `.env` at a PostgreSQL database
(`POSTGRES_*`).

## 2. Check it

```bash
tuvl validate --strict
```

```
triage_ticket  4 agents · 2 deterministic · 1 bounded · 1 external  ·  worst-case 500 tok
✓ Validation passed
```

Every workflow gets a **determinism profile** and a **worst-case token cost**. Then run the tests —
offline, with recorded and mocked results:

```bash
tuvl test
tuvl spec status        # every task derived as done
```

## 3. Open Insight

```bash
tuvl dev --auto-login   # http://localhost:8885/insight
```

- **Workflows → triage_ticket** shows the graph: `classify` (llm) → `prioritise` → `review`
  (human) → `store` (tool). Click a card to see its contract and engine.
- **▶ Run** with a ticket. An urgent one stops at `review`: the **Runs** page shows the approval form;
  approve it and the run continues to `store`.
- **📌 Pin as fixture** turns the run into a test that replays with zero tokens.

## 4. Call it

```bash
curl -X POST localhost:8885/api/tickets/triage \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"subject": "Refund", "body": "I was charged twice", "customer_email": "a@example.com"}'
```

The response is the end's body (`201` with the stored ticket), or `202` with a run descriptor when
the run waits for a person. Follow it with `tuvl runs tail <run_id>` or
`GET /api/runs/<run_id>/events` (SSE). In dev mode the session key works as an admin token.

## 5. Change something

Open `specs/triage-ticket.md`, add a policy, and let tuvl plan the change:

```bash
tuvl spec analyse specs/triage-ticket.md           # proposed contracts + tasks (dry run)
tuvl spec analyse specs/triage-ticket.md --apply
tuvl spec status                                   # the new tasks, derived
```

Implement the tasks (YAML engine blocks; Python only for `code` agents), then run the CI gate:

```bash
tuvl validate --strict && tuvl codegen --check && tuvl lock --check && tuvl test && tuvl spec status --strict
```

Next: the [Agentic Manual](../internals/tuvl-agentic-manual.md) and
[spec-driven development](../internals/spec-driven.md).
