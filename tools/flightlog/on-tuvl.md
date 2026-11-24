# Flightlog on tuvl

<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

The same collector, written as a tuvl project: 5 models, 20 workflows and 24 small code agents. It speaks the same contract as the
[Python build](index.md), so a developer's `tuvl set dev-telemetry` and `tuvl register developer` work against either. It needs
PostgreSQL, tuvl 2.0 and, for revocation that survives a restart, Redis.

**What it has:** register, `/me`, token rotation, ingest (once per event, a per-developer rate limit), the team feed, teams, approval and
revocation, export, retention, an admin log, a forwarding status, and two forwarders: https with a bearer token, and JSON lines to S3,
Azure, GCS or a directory. 21 end-to-end tests cover it, and `tuvl ship` passes tuvl's code review gate.

## Run the image

The tuvl build is on Docker Hub as `tuvl/flightlog` (`0.1.0` and `latest`; amd64 and arm64): the production image `tuvl ship` writes,
non-root, with only the runtime files. It needs PostgreSQL (tried with 16), and Redis if revoked tokens must stay revoked across restarts.

```yaml
# compose.yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: flightlog, POSTGRES_PASSWORD: change-me, POSTGRES_DB: flightlog }
    volumes: [db:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
  flightlog:
    image: tuvl/flightlog:0.1.0
    depends_on: [db, redis]
    environment:
      POSTGRES_HOST: db
      POSTGRES_DB: flightlog
      POSTGRES_USER: flightlog
      POSTGRES_PASSWORD: change-me
      REDIS_HOST: redis
      TUVL_SIGNING_KEY: ${TUVL_SIGNING_KEY}      # openssl rand -hex 32; keep it, it signs every token
    ports: ["127.0.0.1:8885:8885"]
volumes:
  db:
```

`TUVL_SIGNING_KEY=$(openssl rand -hex 32) docker compose up -d` creates the tables on first start. Put TLS in front of it (a reverse
proxy) and publish port 8885 only to that proxy, then follow the steps below. Settings that are YAML (retention, token lifetime, approval,
the rate limit, forwarding) are changed in the project and the image rebuilt with `tuvl ship`.

## Run it from the project

```bash
cp .env.example .env                  # POSTGRES_*, REDIS_*, TUVL_SIGNING_KEY (tuvl generate key)
tuvl serve app -p 8897 -d .
```

1. `POST /auth/bootstrap` once to create the administrator, then sign in at `/auth/token`.
2. Administration is workflows, started by an administrator. With `TUVL_URL` and `TUVL_TOKEN` set:

    ```bash
    tuvl run workflow admin_create_team -p '{"name":"payments"}'    # prints the run id
    tuvl show run RUN_ID                                            # the join code, once
    tuvl run workflow admin_revoke_developer -p '{"who":"asha@example.com"}'
    tuvl run workflow admin_export -p '{"team":"payments","format":"csv","since_days":30}'
    ```

    The others are `admin_team_code`, `admin_list_teams`, `admin_list_developers`, `admin_approve_developer`, `admin_events`,
    `admin_prune`, `admin_forward_status`, `admin_log` and `admin_check`.
3. Developers register at `POST /v1/register {team_code, name, email, initials?}` (or `tuvl register developer`) and get a token with the
   scopes `flightlog:send` and `flightlog:read`.

## Settings are the project's YAML

tuvl keeps configuration in the project and secrets in `.env`, where only the engine reads them.

| Setting | Where |
|---|---|
| Hold new developers for approval | `workflows/register_developer.yaml`: `with.require_approval` |
| Token lifetime in days (default 365) | `register_developer` and `rotate_token`: `with.token_days` |
| Events per developer per minute (default 600) | `workflows/ingest_events.yaml`: `with.max_events_per_minute` |
| Retention in days (`0` keeps everything) | `workflows/sweep_retention.yaml`: `with.retention_days` |
| Forward over https | turn on the schedule in `workflows/forward_webhook.yaml`; `FLIGHTLOG_FORWARD_URL` and `FLIGHTLOG_FORWARD_TOKEN` in `.env` |
| Forward to files or a bucket | turn on the schedule in `workflows/forward_archive.yaml`; point `storage/archive.yaml` at your store |

## What it does not do

- **Run records hold what a workflow returns.** tuvl keeps each run's output, so the join code and the token a registration returns are
  stored in `tuvl_system_runs`; the journal redacts `secure` fields, the run record does not. Give `runs:read` to administrators only and keep
  `token_days` short. Where a leaked database must not yield usable tokens, run the Python build, which stores hashes.
- **Forwarding is bearer-authenticated, not HMAC-signed.** A code agent cannot read secrets, so signing needs an engine feature that does not
  exist yet.
- **No per-address rate limit.** Limit `/v1/register` by address in your proxy.
- **PostgreSQL only**, and revocation needs Redis. Backups are `pg_dump`.

## What building it on tuvl showed

- **What fit.** Teams as data, tokens and revocation from tuvl's own IAM machinery, ingest as a workflow, forwarding as a three-step workflow
  (pick a batch, send it, move the cursor), and an audit trail of every call from the run journal.
- **What did not.** `ctx.db` has equality filters and no ordering, so the few queries that need a range or an order use the engine session, in
  one small module. Settings come in as `code.with`, not from the environment, because the code review gate refuses a code agent that reads
  it. And the engine found its own bug on the way: a request could answer `202` for a run that finished a few milliseconds later (fixed in
  tuvl-private #145).
- **Which to run.** The Python build is the smaller surface and hashes tokens; the tuvl build is the one to run beside the rest of your tuvl
  estate, and to read and change as YAML.
