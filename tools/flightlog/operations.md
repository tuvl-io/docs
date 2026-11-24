<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

# Operations


## Configuration

Settings come from the command line or the environment. Anything that can hold a secret is an environment variable, never a
file the service writes.

| Setting | Flag | Environment | Default |
|---|---|---|---|
| Database | `--database-url` (before the command) | `FLIGHTLOG_DATABASE_URL` | `flightlog.db` (SQLite) |
| Settings file | `--config` | `FLIGHTLOG_CONFIG` | none |
| Bind address and port | `serve --host --port` | `FLIGHTLOG_HOST`, `FLIGHTLOG_PORT` | `127.0.0.1`, `8800` |
| TLS | `serve --tls-cert --tls-key` | `FLIGHTLOG_TLS_CERT`, `FLIGHTLOG_TLS_KEY` | off |
| Trust a proxy's `X-Forwarded-For` | `serve --forwarded-allow-ips` | `FLIGHTLOG_FORWARDED_ALLOW_IPS` | off |
| Hold new developers for approval | `serve --require-approval` | `FLIGHTLOG_REQUIRE_APPROVAL` | off |
| Retention | `serve --retention-days` | `FLIGHTLOG_RETENTION_DAYS` | keep everything |
| `/metrics` | none | `FLIGHTLOG_METRICS_TOKEN` (the variable named by `--metrics-token-env`) | off |

The settings file (YAML) holds `retention_days` and the `forward:` list; see [forwarding](forwarding.md) and
`deploy/flightlog.example.yaml`.

## The database

- **SQLite** (the default) is one file with write-ahead logging. Good for a trial and for a small team on one host. One service
  process per file.
- **PostgreSQL** is the choice for a company: `FLIGHTLOG_DATABASE_URL=postgresql://user:password@host:5432/flightlog`. Install with the
  `postgres` extra (the Docker image has it). Flightlog creates its tables on first start (`create table if not exists`); give its
  user the right to create tables in that database, or create them once with a privileged user by running `tuvl-flightlog check`.
  Several replicas can share one PostgreSQL.
- Passwords in the URL stay in the environment (a secret in Kubernetes, `.env` in Compose), never in a file you commit.

## Day to day

```bash
tuvl-flightlog team create payments            # a team and its join code (shown once)
tuvl-flightlog team code payments              # a new join code; the old one stops working
tuvl-flightlog developer list                  # id, name, initials, email, team, state, events, last seen
tuvl-flightlog developer approve ada@example.org      # with --require-approval
tuvl-flightlog developer revoke  ada@example.org      # the token dies at once; the email can register again
tuvl-flightlog events --team payments -n 30    # what the team did
tuvl-flightlog admin-log                       # what administrators did, and when
```

Every administrative change (and every start of the service, export, prune and backup) is written to the admin log with the
operating-system user who ran it. A developer who loses a token registers again after you revoke the old one, or rotates it
from tuvl (`POST /v1/token/rotate`).

## Retention

By default events are kept. To bound them:

```bash
tuvl-flightlog prune --older-than 365 --dry-run      # how many would go
tuvl-flightlog prune --older-than 365                # delete them (logged)
```

or let the service do it: `FLIGHTLOG_RETENTION_DAYS=365` sweeps every six hours. Retention counts from when an event was received.
Forward events to your archive first if you need them longer (see [forwarding](forwarding.md)).

## Export

```bash
tuvl-flightlog export --format jsonl -o events.jsonl                 # everything, oldest first
tuvl-flightlog export --format csv --team payments --since 30 -o last-30-days.csv
```

## Backups

- **SQLite:** `tuvl-flightlog backup /backups/flightlog-$(date +%F).db` makes a consistent copy while the service runs (private to the
  user, and it refuses to overwrite).
- **PostgreSQL:** `pg_dump --format=custom "$FLIGHTLOG_DATABASE_URL" > flightlog.dump`; restore with `pg_restore`.
- Back up the database, not the container. Test a restore.

## Upgrades

Install the new version (or pull the new image) and restart; the schema is versioned in the `meta` table and tables are created
or kept as they are. Take a backup first. Several replicas can be rolled one at a time.

## Health, readiness and metrics

`/health` is liveness, `/ready` also checks the database. With `FLIGHTLOG_METRICS_TOKEN` set, `GET /metrics` (bearer token) returns
Prometheus text: `flightlog_events`, `flightlog_developers`, `flightlog_teams`, `flightlog_events_ingested_total`,
`flightlog_http_responses_total{class="2xx|4xx|5xx"}`. Keep `/metrics` off the public route (the Caddy and nginx examples do).

## Troubleshooting

| You see | Look at |
|---|---|
| `tuvl check dev-telemetry` says 401 | the token was revoked or never registered: `tuvl register developer` |
| Events queue up on a developer's machine (`tuvl show dev-telemetry`) | the server is down, the certificate is not trusted (set `TUVL_DEV_TELEMETRY_CA` to your CA bundle), or the token is missing |
| 429 | a developer or one address is over the limit (120 requests a minute per developer, 10 registrations a minute per address, per process). Behind a proxy, set `--forwarded-allow-ips` so the real address is used |
| `/ready` is 503 | the database is down or the credentials changed: `tuvl-flightlog check` |
| A sink falls behind | `tuvl-flightlog forward status` shows how many events wait; the receiver is down or refusing |
