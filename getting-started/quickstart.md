# Quickstart

This walks through the sample project: a support-ticket triage workflow with a spec, a task list,
tests and a lock that pass the CI gate as created. Install tuvl as shown in
[Installation](installation.md) first.

## 1. Create the project

```bash
tuvl init triage --sample --preset gemini -y      # or openai | anthropic | ollama
cd triage
```

The preset writes `llms/default.yaml` (the agents' model) and reads the API key from your environment
into `.env`. Point `.env` at a PostgreSQL database
(`POSTGRES_*`).

## 2. Check it

```bash
tuvl lint project --strict
```

```
triage_ticket  4 agents · 2 deterministic · 1 bounded · 1 external  ·  worst-case 500 tok
✓ Validation passed
```

Every workflow gets a **determinism profile** and a **worst-case token cost**. Then run the tests —
offline, with recorded and mocked results:

```bash
tuvl run tests
tuvl list tasks        # every task derived as done
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
the run waits for a person. Follow it with `tuvl follow run <run_id>` or
`GET /api/runs/<run_id>/events` (SSE). In dev mode the session key works as an admin token.

## 5. Change something

Open `specs/triage-ticket.md` and add a policy. Then hand it to your coding agent (it has the
`tuvl-spec`, `tuvl-plan` and `tuvl-task-loop` skills); tuvl referees the result:

```bash
tuvl lint spec                      # the spec is well-formed
tuvl show drift                       # what changed since the task list was written
tuvl list tasks                     # the tasks, with status derived from the project
```

The agent updates `specs/triage-ticket.tasks.yaml` and implements the tasks (YAML engine blocks;
Python only for `code` agents). Then run the CI gate:

```bash
tuvl lint spec && tuvl lint project --strict && tuvl generate code --check && tuvl verify lock \
  && tuvl run tests --strict && tuvl verify spec --strict && tuvl list tasks --strict
```

Next: the step-by-step [guide from init to ship](guide.md) builds a project of your own, with a coding
agent or by hand. Then the [Agentic Manual](../internals/tuvl-agentic-manual.md) and
[spec-driven development](../internals/spec-driven.md).
