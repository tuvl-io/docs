# TypeScript SDK

`@tuvl/client` is the official TypeScript SDK for the tuvl workflow engine. It gives frontend and Node.js applications a type-safe, zero-config way to invoke workflows across three transports — plain REST, Server-Sent Events, and gRPC-Web — from a single unified API.

---

## How it fits in the stack

```
Your app (React / Vue / Node.js)
        │
        │  import { TuvlClient } from "@tuvl/client"
        ▼
┌──────────────────────────┐
│        TuvlClient        │  auto-selects transport
├──────────────────────────┤
│   REST  │  SSE  │  gRPC  │
└────┬────┴───┬───┴────┬───┘
     │        │        │
     ▼        ▼        ▼
     POST   stream   stream
         tuvl server :8000
              │
         WorkflowEngine
```

The client uses the `/api/_system/workflows/{name}` manifest endpoint to discover each workflow's trigger path and streaming hints at runtime, so you never hardcode API paths in the frontend.

---

## Transports

### REST (default)

Used when no `onProgress` callback is provided, or when `mode: "rest"` is forced. The server runs the full workflow synchronously and returns a single JSON response.

Best for: fast workflows (functional, router, model-op steps only), simple CRUD-like calls, server-side Node.js where streaming UI is not needed.

### SSE (Server-Sent Events)

Activated automatically when `onProgress` is provided **and** the workflow manifest reports `has_slow_steps: true` (meaning it contains `agent`, `mcp`, or `api_call` steps). Can also be forced with `mode: "sse"`.

The server streams one event per step as it completes, then a final `done` event with the result. Uses standard fetch + `ReadableStream` — works in browsers (Chrome 78+, Firefox 100+, Safari 15+) and Node.js 18+.

Best for: LLM agent workflows, MCP calls, long-running API chains where showing progress matters.

### gRPC-Web

Force with `mode: "grpc"`. Uses binary protobuf framing over HTTP/1.1 (the gRPC-Web spec) via `sonora` on the server. Requires optional peer dependencies:

```bash
npm install @protobuf-ts/grpcweb-transport @protobuf-ts/runtime-rpc
```

The gRPC module is dynamically imported — zero bundle cost if never used.

Best for: high-throughput environments, teams already using protobuf tooling, future server-defined UI plugins.

---

## Manifest caching

On the first `execute()` call for a workflow, the client fetches the manifest and caches it for 60 seconds (configurable via `manifestCacheTtl`). Subsequent calls reuse the cache, avoiding an extra round-trip. The cache can be cleared manually:

```ts
client.invalidateManifest("screen-candidate"); // one workflow
client.invalidateManifest();                   // all workflows
```

---

## Authentication

The SDK injects a `Authorization: Bearer <token>` header on every request. The token is set at construction time and can be updated at any time:

```ts
const client = new TuvlClient({ baseUrl, token: initialToken });

// After token refresh:
client.setToken(newToken);
```

Per-call overrides are also supported:

```ts
await client.execute("admin-workflow", {
  payload: {},
  token: elevatedToken,
});
```

---

## Error handling

`execute()` throws on:

- Network errors (fetch failure)
- HTTP 4xx / 5xx from the server
- A workflow `error` event (SSE or gRPC stream)
- An SSE stream that closes without a `done` event

```ts
try {
  const result = await client.execute("screen-candidate", { payload });
} catch (err) {
  // err.message contains the server error detail
}
```

---

## Next steps

- [Quickstart](quickstart.md) — install and make your first call in 5 minutes
- [API Reference](api-reference.md) — complete method and type reference
