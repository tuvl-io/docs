# SDK API Reference

Complete reference for all classes, methods, and types exported by `@tuvl/client`.

---

## `TuvlClient`

The main class. Create one instance per application and reuse it.

```ts
import { TuvlClient } from "@tuvl/client";

const client = new TuvlClient(options: TuvlClientOptions);
```

### Constructor options

```ts
interface TuvlClientOptions {
  baseUrl: string;
  token?: string;
  manifestCacheTtl?: number;
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | required | Base URL of the tuvl server. Trailing slash is stripped automatically. |
| `token` | `string` | — | Default Biscuit Bearer token injected on every request. Can be overridden per-call. |
| `manifestCacheTtl` | `number` | `60000` | Milliseconds to cache workflow manifests. Set to `0` to disable caching. |

---

### `client.execute(workflowName, options?)`

Execute a workflow and return the final output.

```ts
execute<TOutput = unknown>(
  workflowName: string,
  options?: ExecuteOptions<TOutput>
): Promise<TOutput>
```

Transport is chosen automatically based on `options.mode` and the workflow manifest. See [Transport selection](#transport-selection).

#### `ExecuteOptions`

```ts
interface ExecuteOptions<TOutput = unknown> {
  payload?:    Record<string, unknown>;
  onProgress?: (event: StepEvent) => void;
  mode?:       "rest" | "sse" | "grpc";
  token?:      string;
  signal?:     AbortSignal;
}
```

| Property | Type | Description |
|---|---|---|
| `payload` | `Record<string, unknown>` | JSON body sent as the workflow trigger input. Must match the workflow's `input_schema`. Defaults to `{}`. |
| `onProgress` | `(event: StepEvent) => void` | Callback invoked for each step event during SSE or gRPC streaming. Has no effect in REST mode. |
| `mode` | `"rest" \| "sse" \| "grpc"` | Force a specific transport. When omitted, the SDK auto-detects based on `onProgress` and `has_slow_steps`. |
| `token` | `string` | Overrides the client's default token for this call only. |
| `signal` | `AbortSignal` | Abort signal to cancel an in-flight request or stream. |

#### Transport selection

```
mode === "grpc"                               → gRPC-Web
mode === "sse"                                → SSE
onProgress provided AND has_slow_steps=true  → SSE (auto)
everything else                               → REST
```

`has_slow_steps` is read from the cached workflow manifest. A workflow has slow steps when it contains at least one `agent`, `mcp`, or `api_call` step.

---

### `client.getManifest(workflowName, options?)`

Fetch (and cache) the manifest for a single workflow.

```ts
getManifest(
  workflowName: string,
  options?: { token?: string; signal?: AbortSignal }
): Promise<WorkflowManifest>
```

Called automatically by `execute()`. You can call it directly to pre-warm the cache or inspect routing hints before making a call.

---

### `client.listWorkflows(options?)`

Fetch manifests for all registered workflows.

```ts
listWorkflows(
  options?: { token?: string; signal?: AbortSignal }
): Promise<WorkflowManifestMap>
```

Calls `GET /api/_system/workflows`. Result is not cached.

---

### `client.setToken(token)`

Update the default auth token at runtime without recreating the client.

```ts
setToken(token: string): void
```

Useful after a token refresh in a long-lived SPA session.

---

### `client.invalidateManifest(workflowName?)`

Clear the manifest cache for one workflow, or all workflows.

```ts
invalidateManifest(workflowName?: string): void
```

Call this if you hot-reload workflow YAML files and want the SDK to pick up changes without waiting for the TTL to expire.

---

## Types

### `StepEvent`

A single execution event yielded per step during SSE or gRPC streaming.

```ts
interface StepEvent {
  event_type:   "step" | "done" | "error";
  step_id:      string;
  kind:         string;
  signal:       string;
  snapshot:     Record<string, unknown>;
  duration_ms:  number;
  error_detail?: string;
}
```

| Field | Description |
|---|---|
| `event_type` | `"step"` during execution, `"done"` on success, `"error"` on failure |
| `step_id` | The step's `id` field from the workflow YAML |
| `kind` | Step kind: `functional`, `agent`, `mcp`, `api_call`, `router`, `response`, `model-op` |
| `signal` | Routing signal emitted by the step (e.g. `"default"`, `"true"`, `"false"`, custom) |
| `snapshot` | All public context keys (no `_` prefix) after this step completed |
| `duration_ms` | Wall time for this step in milliseconds |
| `error_detail` | Error message when `event_type === "error"` |

---

### `DoneEvent`

Terminal event emitted when the workflow completes successfully.

```ts
interface DoneEvent {
  event_type: "done";
  output: unknown;
}
```

`output` is the final response value — shaped by `output_key` or `_response` in the workflow context, or the full public context if neither is set.

---

### `ErrorEvent`

Terminal event emitted when the workflow fails.

```ts
interface ErrorEvent {
  event_type: "error";
  message:    string;
  details?:   string;
}
```

---

### `WorkflowManifest`

Shape returned by `GET /api/_system/workflows/{name}`.

```ts
interface WorkflowManifest {
  name:               string;
  trigger_path:       string;
  trigger_method:     string;
  has_slow_steps:     boolean;
  slow_kinds_present: string[];
  required_scope:     string | null;
  required_group:     string | null;
  steps:              Array<{ id: string; kind: string }>;
}
```

| Field | Description |
|---|---|
| `trigger_path` | The HTTP path the workflow is mounted at (e.g. `/api/hello`) |
| `trigger_method` | HTTP verb (`POST`, `GET`, etc.) |
| `has_slow_steps` | `true` if the workflow has `agent`, `mcp`, or `api_call` steps |
| `slow_kinds_present` | List of slow step kinds found (e.g. `["agent", "mcp"]`) |
| `required_scope` | Biscuit scope required to call this workflow, or `null` |
| `required_group` | IAM group required to call this workflow, or `null` |
| `steps` | Ordered list of `{id, kind}` for each step |

---

### `WorkflowManifestMap`

Shape returned by `GET /api/_system/workflows` (all workflows).

```ts
type WorkflowManifestMap = Record<string, Omit<WorkflowManifest, "name" | "steps">>;
```

---

## Lower-level exports

These are available for advanced use cases where you need to drive SSE parsing or gRPC streaming directly.

### `Transport`

Raw HTTP layer. Handles auth header injection, content-type negotiation, and serialisation.

```ts
import { Transport } from "@tuvl/client";

const transport = new Transport({ baseUrl, defaultToken });

transport.post(path, body, options?)       // → Promise<TResponse>
transport.postStream(path, body, options?) // → Promise<Response>
transport.get(path, options?)              // → Promise<TResponse>
transport.setToken(token)                  // → void
```

### `parseSseStream(response, signal?)`

Async generator that parses SSE frames from a `Response.body` `ReadableStream`.

```ts
import { parseSseStream } from "@tuvl/client";

const response = await transport.postStream("/api/hello", payload);

for await (const frame of parseSseStream(response)) {
  if (frame.event_type === "step")  console.log(frame.step_id);
  if (frame.event_type === "done")  console.log(frame.output);
  if (frame.event_type === "error") throw new Error(frame.message);
}
```

### `openGrpcStream(options)`

Async generator for gRPC-Web streaming. Dynamically imports `@protobuf-ts/grpcweb-transport` — throws a descriptive error if the peer dep is missing.

```ts
import { openGrpcStream } from "@tuvl/client";

for await (const event of openGrpcStream({
  baseUrl:      "http://localhost:8000",
  workflowName: "screen-candidate",
  payloadJson:  JSON.stringify({ candidate_id: 42 }),
  token:        "...",
})) {
  console.log(event.event_type, event.step_id);
}
```

#### `GrpcRunOptions`

```ts
interface GrpcRunOptions {
  baseUrl:        string;
  workflowName:   string;
  payloadJson:    string;
  tokenFallback?: string;
  token?:         string;
  signal?:        AbortSignal;
}
```

| Field | Description |
|---|---|
| `payloadJson` | The workflow input serialised as a JSON string |
| `tokenFallback` | Alternative token sent in the proto message body — used in browser environments where custom headers are blocked |
