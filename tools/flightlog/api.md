<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

# The contract


Anything that speaks this can be the collector tuvl talks to (the developer's side is in [Developer Telemetry](../../internals/dev-telemetry.md)); Flightlog is one implementation. All paths are under `<server>/v1`
(plus `/health` and `/ready`). Everything except `/register` carries `Authorization: Bearer <token>`. Bodies are JSON.

| Endpoint | |
|---|---|
| `POST /v1/register` | `{name, email, team_code, initials?}` → `201 {token, developer: {id, name, email, initials, team, approved}}`. `403` for an invalid join code, `409` when that email is already registered in the team, `422` for bad input (initials are 2 to 6 letters or digits; blank means made from the name), `429` when throttled |
| `GET /v1/me` | `{id, name, email, initials, team}` of the token's owner; `401` for an unknown, revoked or not yet approved token |
| `POST /v1/token/rotate` | `{token}`: a new token; the old one stops working at once |
| `POST /v1/dev-events` | `{"schema": "tuvl.dev-events/1", "sender": {tuvl, project, name, host, branch}, "events": [...]}` (at most 200 events and 1 MB) → `{accepted, duplicates}`. Delivery is at-least-once: an event is identified by `(id, team)` and stored once |
| `GET /v1/team/events` | `{events: [...]}` of the caller's team, newest first. Query: `project`, `actor` (a name or an email), `entity`, `kind`, `before` (an event id), `limit` (1 to 200) |
| `GET /health` | liveness: `{"status": "ok"}` |
| `GET /ready` | readiness: `200` when the database answers, else `503` |
| `GET /metrics` | Prometheus text; `404` unless a metrics token is configured and sent |

An event: `{"id": "<ULID>", "ts": "2026-10-22T08:41:23.114Z", "kind": "task.failed", "command": "generate code", "actor": {"initials": "AL"}, "entities": ["TASK-…"], "result": "failed", "detail": "attempt 2", "refs": {...}}`.
`kind` is a tuvl audit kind (`idea.imported`, `spec.approved`, `tasks.derived`, `task.attempt`, `task.failed`, `branch.created`,
`pr.opened`, `gate.result`, `ship.packaged` …) or `cli.command`.

What comes back in `team/events`: each event with `developer: {id, name, initials}` (decided by the server from the token),
`claimed` (what the event said about its actor, kept apart and not trusted), `team`, `project` and `branch`.
