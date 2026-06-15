# SDK Quickstart

Get `@tuvl/client` installed and making live calls in under 5 minutes.

## Prerequisites

- tuvl server running (`tuvl dev` or `tuvl run`) — see [Installation](../getting-started/installation.md)
- A Bearer token — in dev mode the `TUVL_DEV_API_KEY` from your `.env` works

---

## 1. Install

=== "npm"

    ```bash
    npm install @tuvl/client
    ```

=== "pnpm"

    ```bash
    pnpm add @tuvl/client
    ```

=== "yarn"

    ```bash
    yarn add @tuvl/client
    ```

---

## 2. Create a client

```ts
import { TuvlClient } from "@tuvl/client";

const client = new TuvlClient({
  baseUrl: "http://localhost:8000",
  token: process.env.TUVL_TOKEN, // (1)
});
```

1. In a browser app, pass the token obtained from your login flow. In dev mode, use `TUVL_DEV_API_KEY` from your `.env`.

---

## 3. Call a workflow (REST)

```ts
const result = await client.execute("hello", {
  payload: { message: "world" },
});

console.log(result); // "Echo: world"
```

`execute()` resolves with the workflow's final output — equivalent to a `POST /api/hello` but with the path resolved automatically from the manifest.

---

## 4. Stream progress (SSE)

For workflows with LLM agents, MCP calls, or external API steps, stream each step as it completes:

```ts
const result = await client.execute("screen-candidate", {
  payload: { candidate_id: 42 },
  onProgress: (ev) => {
    console.log(`  ✔ ${ev.step_id} (${ev.kind}) — ${ev.duration_ms}ms`);
    // ev.snapshot is the full workflow context after this step
  },
});

console.log("Final output:", result);
```

!!! info "Auto-detection"
    You do not need to set `mode: "sse"` explicitly. The SDK fetches the workflow manifest and switches to SSE automatically when `onProgress` is provided and the workflow contains slow steps (`agent`, `mcp`, `api_call`). For fast workflows it falls back to REST silently.

---

## 5. React example

```tsx
import { useState } from "react";
import { TuvlClient, type StepEvent } from "@tuvl/client";

const client = new TuvlClient({
  baseUrl: import.meta.env.VITE_TUVL_URL,
  token: import.meta.env.VITE_TUVL_TOKEN,
});

export function ScreeningButton({ candidateId }: { candidateId: number }) {
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setSteps([]);

    const output = await client.execute("screen-candidate", {
      payload: { candidate_id: candidateId },
      onProgress: (ev) => setSteps((prev) => [...prev, ev]),
    });

    setResult(output);
    setLoading(false);
  }

  return (
    <div>
      <button onClick={run} disabled={loading}>
        {loading ? "Screening…" : "Screen Candidate"}
      </button>

      {steps.map((ev) => (
        <div key={ev.step_id}>
          {ev.step_id} — {ev.signal} ({ev.duration_ms}ms)
        </div>
      ))}

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

---

## 6. Read model data (CRUD)

Every tuvl model gets auto-generated REST endpoints. Access them with `client.crud()`:

```ts
import { TuvlClient } from "@tuvl/client";

const client = new TuvlClient({ baseUrl: "http://localhost:8000", token });

// List all candidates
const candidates = await client.crud("candidate").list();

// Filter + embed related records
const screened = await client.crud("candidate").list({
  filters: { stage: "screening" },
  include: ["posting"],
  limit: 25,
});

// Get one record
const candidate = await client.crud("candidate").get("uuid-here");

// Create
const created = await client.crud("candidate").create({
  name: "Alice",
  email: "alice@example.com",
  stage: "applied",
});

// Partial update (only the fields you pass are changed)
await client.crud("candidate").update(created.id, { stage: "interview" });

// Delete
await client.crud("candidate").delete(created.id);
```

!!! info "Scopes"
    CRUD endpoints enforce `{modelname}:read`, `:write`, and `:delete` Biscuit scopes. Check `me.scopes` from `auth.getMe(token)` before calling CRUD methods if you need to gate UI features.

---

## 8. Force a transport

```ts
// Always SSE regardless of workflow hints
await client.execute("hello", {
  payload: { message: "forced" },
  mode: "sse",
  onProgress: console.log,
});

// Always REST regardless of slow steps
await client.execute("screen-candidate", {
  payload: { candidate_id: 1 },
  mode: "rest",
});
```

---

## 9. Cancellation

```ts
const controller = new AbortController();

// Cancel after 10 s
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  await client.execute("long-workflow", {
    payload: {},
    signal: controller.signal,
    onProgress: (ev) => console.log(ev.step_id),
  });
} finally {
  clearTimeout(timeout);
}
```

---

## Next steps

- [API Reference](api-reference.md) — complete method, type, and transport documentation
- [CLI: stream-watch](../cli/commands.md#tuvl-stream-watch) — stream workflows from the terminal without writing any code
