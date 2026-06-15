# SDK API Reference

Complete reference for all classes, methods, and types exported by `@tuvl/client`.

---

## `TuvlAuth`

Authentication helper. Wraps all `/auth/*` endpoints. Create one instance per application.

```ts
import { TuvlAuth } from "@tuvl/client";

const auth = new TuvlAuth({ baseUrl: "http://localhost:8000" });
```

### Constructor options

| Property | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Base URL of the tuvl server. Trailing slash is stripped automatically. |

---

### `auth.loginWithPassword(email, password)`

Exchange an email + password for a Biscuit bearer token.

```ts
loginWithPassword(email: string, password: string): Promise<TokenResponse>
```

Calls `POST /auth/token` with an `application/x-www-form-urlencoded` body (OAuth2 password-grant format).

```ts
const { access_token } = await auth.loginWithPassword("me@example.com", "secret");
```

---

### `auth.getOAuthLoginUrl(provider)`

Return the URL the browser should navigate to in order to start an OAuth2 login flow.

```ts
getOAuthLoginUrl(provider: string): string
```

Built-in providers: `"google"`, `"github"`, `"microsoft"`. Any provider configured in the server's `federation/` directory also works.

```ts
// In a React component
<button onClick={() => { window.location.href = auth.getOAuthLoginUrl("google"); }}>
  Login with Google
</button>

// On the landing page (TUVL_OAUTH_UI_REDIRECT_URL):
const token = new URLSearchParams(window.location.search).get("token")!;
```

---

### `auth.getMe(token)`

Decode the token server-side and return the user's identity, role memberships, and permission scopes.

```ts
getMe(token: string): Promise<MeResponse>
```

This is the correct way to read "who is logged in" and "what can they do". Biscuit tokens are protobuf-encoded and cannot be decoded in pure JS without a WASM library — `getMe()` lets the server do the decoding and returns a plain JSON object.

```ts
const me = await auth.getMe(token);

console.log(me.user_id);  // "550e8400-e29b-41d4-a716-446655440000"
console.log(me.groups);   // ["hr_manager", "member"]
console.log(me.scopes);   // ["requisition:write", "candidate:read"]

// Role guard
if (me.groups.includes("hr_manager")) { /* show HR UI */ }

// Scope guard
if (me.scopes.includes("iam:admin")) { /* show admin panel */ }
```

---

### `auth.refresh(token)`

Exchange a valid token for a fresh one with a new TTL. The old token is immediately blacklisted.

```ts
refresh(token: string): Promise<TokenResponse>
```

```ts
const { access_token: newToken } = await auth.refresh(currentToken);
client.setToken(newToken); // update TuvlClient in-place
```

---

### `auth.logout(token)`

Revoke the token. Resolves silently on success (HTTP 204).

```ts
logout(token: string): Promise<void>
```

After calling this, delete the token from all local storage. The token is blacklisted across all workers that share a Redis instance.

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

### `client.crud<TRead, TCreate, TUpdate>(modelName)`

Return a `CrudClient` instance targeting `/models/{modelname}/`. Shares the same transport (base URL + auth token) as the parent `TuvlClient`.

```ts
crud<TRead = unknown, TCreate = Partial<TRead>, TUpdate = Partial<TRead>>(
  modelName: string
): CrudClient<TRead, TCreate, TUpdate>
```

See the [CrudClient](#crudclient) section below for full method documentation.

---

## `CrudClient`

Typed REST client for tuvl model endpoints. Obtain via `client.crud(modelName)` — do not instantiate directly.

### Methods

#### `crud.list(options?)`

```ts
list(options?: CrudListOptions): Promise<TRead[]>
```

Fetches `GET /models/{model}/`. Returns an array of records.

##### `CrudListOptions`

```ts
interface CrudListOptions {
  limit?:   number;                   // default 100, max 1000
  offset?:  number;
  filters?: Record<string, string>;   // { stage: "screening" } → ?filter[stage]=screening
  include?: string[];                 // ["posting"] → ?include=posting
  token?:   string;
  signal?:  AbortSignal;
}
```

| Field | Description |
|---|---|
| `filters` | Bracket-notation field filters. Every key becomes `filter[key]=value` in the query string. |
| `include` | Comma-joined relation names to embed in the response (server performs an IN-clause batch load, not N+1). |

#### `crud.get(id, options?)`

```ts
get(id: string, options?: CrudGetOptions): Promise<TRead>
```

Fetches `GET /models/{model}/{id}`. Throws on HTTP 404.

##### `CrudGetOptions`

```ts
interface CrudGetOptions {
  include?: string[];
  token?:   string;
  signal?:  AbortSignal;
}
```

#### `crud.create(body, options?)`

```ts
create(body: TCreate, options?: CrudMutateOptions): Promise<TRead>
```

Posts `POST /models/{model}/`. Returns the created record (HTTP 201).

#### `crud.update(id, body, options?)`

```ts
update(id: string, body: TUpdate, options?: CrudMutateOptions): Promise<TRead>
```

Patches `PATCH /models/{model}/{id}`. Only fields present in `body` are modified. Throws on HTTP 404.

#### `crud.delete(id, options?)`

```ts
delete(id: string, options?: CrudMutateOptions): Promise<void>
```

Sends `DELETE /models/{model}/{id}`. Resolves `void` on HTTP 204. Throws on HTTP 404.

##### `CrudMutateOptions`

```ts
interface CrudMutateOptions {
  token?:  string;
  signal?: AbortSignal;
}
```

### Auth scopes

| Operation | Required Biscuit scope |
|---|---|
| `list()` / `get()` | `{modelname}:read` |
| `create()` / `update()` | `{modelname}:write` |
| `delete()` | `{modelname}:delete` |

Scope names are derived from the lowercase model name. They can be overridden per-model via `spec.access.{read,write,delete}_scope` in the model YAML.

### Error behaviour

All `CrudClient` methods throw a plain `Error` on non-2xx HTTP responses. CRUD calls do **not** throw `TuvlWorkflowError` or `TuvlWorkflowSuspendedError`.

### Example

```ts
import { TuvlClient } from "@tuvl/client";

interface Candidate {
  id:    string;
  name:  string;
  stage: string;
  email: string;
}

const client = new TuvlClient({ baseUrl: "http://localhost:8000", token });

// List with filters + pagination + relations
const candidates = await client.crud<Candidate>("candidate").list({
  filters: { stage: "screening" },
  include: ["posting"],
  limit: 50,
  offset: 0,
});

// Get one
const c = await client.crud<Candidate>("candidate").get(id);

// Create
const created = await client.crud<Candidate, Omit<Candidate, "id">>("candidate")
  .create({ name: "Alice", email: "alice@example.com", stage: "applied" });

// Partial update
const updated = await client.crud<Candidate, never, Pick<Candidate, "stage">>("candidate")
  .update(created.id, { stage: "interview" });

// Delete
await client.crud("candidate").delete(updated.id);
```

---

## Types

### `TokenResponse`

Returned by `loginWithPassword()` and `refresh()`.

```ts
interface TokenResponse {
  access_token: string;
  token_type:   string; // always "bearer"
}
```

---

### `MeResponse`

Returned by `getMe()`. Contains the decoded identity and permissions for the current token, without requiring any Biscuit library in the browser.

```ts
interface MeResponse {
  user_id: string;   // user UUID
  groups:  string[]; // role names e.g. ["hr_manager", "member"]
  scopes:  string[]; // permission scopes e.g. ["candidate:read"]
}
```

| Field | Description |
|---|---|
| `user_id` | UUID of the authenticated user, extracted from the `user()` Datalog fact |
| `groups` | All role names assigned to the user, from `group()` Datalog facts |
| `scopes` | All permission scopes, from `scope()` Datalog facts — matches what the server checks on every workflow call |

---

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
transport.patch(path, body, options?)      // → Promise<TResponse>
transport.delete(path, options?)           // → Promise<void>  (expects 204)
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