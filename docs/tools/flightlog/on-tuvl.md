# Flightlog on tuvl

<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

The same collector, built as a tuvl project: three models, four workflows and four code agents. It is a worked example of tuvl serving a
real service with its own tokens, tenants and run journal, and it speaks the same contract as the [Python build](index.md), so developers'
tuvl works against either.

**Python build** (the one to run)

- 1,133 lines of source and 445 of tests.
- SQLite or PostgreSQL.
- The whole contract, plus retention, export, forwarding, backup, TLS and rate limits.
- Its own tokens.

**tuvl build** (the worked example)

- 106 lines of Python and 145 of YAML.
- PostgreSQL only.
- Register, ingest, team feed and create-team.
- tuvl JWT and IAM; every call is a journaled run.
- Not built yet: `/me`, rotation, retention, forwarding, rate limits.

## Run it

Needs PostgreSQL and tuvl 2.0.0b8 or later.

```bash
cp .env.example .env                 # set POSTGRES_*, then add TUVL_SIGNING_KEY (tuvl generate key)
tuvl serve app -p 8897 -d .
```

1. `POST /auth/bootstrap` once to create the admin, then sign in at `/auth/token`.
2. Create a team: `POST /api/workflows/create_team/runs {"input": {"slug": "core", "name": "Core"}}`. The join code is shown once.
3. Developers register at `POST /v1/register {team_code, name, email, initials?}` and get a token with the scopes
   `flightlog:send` and `flightlog:read`.
4. `POST /v1/dev-events` stores a batch once per event id; `GET /v1/team/events` reads the caller's team, newest first.

## What building it on tuvl showed

- **What fit.** Teams as tenants, developers as IAM users with signed tokens, ingest as a workflow whose `tool db` step answers
  `conflict` for a duplicate, and an audit trail that comes free from the run journal. Every call is a durable run.
- **What did not.** Filtering, ordering and `in` queries needed the session directly, which skips the `spec.models` allow-list.
  A field named `schema` collides with pydantic (it becomes `schema_`), and input and output names must be unique across a workflow.
  There is no rate limiting and no cursor-based forwarding outbox.
- **Which to run.** The Python build, until the gaps above close.
