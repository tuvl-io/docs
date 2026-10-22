# Flightlog

<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

!!! warning "Pre-release"
    Flightlog is built and tested (24 tests on SQLite, 40 on PostgreSQL) but not published yet: there is no PyPI package or public
    repository to install from. Until the first release, build it from the checkout (`pip install "./python[postgres]"`). The commands
    and endpoints below are what the first release will ship.


**The log of every flight a team's work takes.** Flightlog receives what each developer does on a [tuvl](https://tuvl.dev) project
(ideas, specs, approvals, tasks, coding-agent attempts, branches, gates, ships and the commands they run), keeps it, and
lets every developer read what the rest of the team did, from their terminal and from Insight.

Flightlog is a separate, self-hosted service. You run it; tuvl sends to it only if the project turns on [**developer telemetry**](../../internals/dev-telemetry.md)
on (`tuvl set dev-telemetry https://flightlog.example.com`). It is open source under the Apache License 2.0.

- **Small surface.** Four developer endpoints, two health checks and nothing else. No web UI, no admin endpoint, no
  interactive API pages. You administer it from a terminal on the server.
- **Real storage.** SQLite for one file and a quick start, PostgreSQL for a company.
- **A token per developer.** Developers register once with a team's join code and get a token of their own. The server
  decides who a token is; what an event claims about its actor is never trusted.
- **Your systems too.** Forward every event to a SIEM or a log shipper (signed webhook or JSON lines), with delivery that
  survives outages.
- **Looked after.** Retention, export, online backup, an admin log of everything administrators did, https built in or
  behind your proxy, metrics for Prometheus (off unless you give a token).

| Read | |
|---|---|
| [Deployment](deployment.md) | Docker Compose with PostgreSQL and automatic https, Kubernetes, nginx, running it directly |
| [Operations](operations.md) | configuration, the commands, retention, backups, upgrades, troubleshooting |
| [Security](security.md) | what it protects, what it does not, and the hardening checklist |
| [Forwarding](forwarding.md) | passing events on to a SIEM, a warehouse or a log shipper |
| [The contract](api.md) | the contract, if you want to write your own receiver |

## Five minutes

```bash
pip install "./python[postgres]"          # from the checkout; later: pip install "tuvl-flightlog[postgres]"

export FLIGHTLOG_DATABASE_URL=postgresql://flightlog:PASSWORD@db.internal/flightlog     # omit for a SQLite file, flightlog.db
tuvl-flightlog check                             # can it reach the database?
tuvl-flightlog team create payments              # prints the join code once
tuvl-flightlog serve --host 0.0.0.0 --port 8800 --tls-cert cert.pem --tls-key key.pem
```

Each developer, in their tuvl project:

```bash
tuvl set dev-telemetry https://flightlog.example.com
tuvl register developer                      # name and email (defaults: git), initials, the join code
tuvl check dev-telemetry
tuvl list team-activity
```

## The commands

```
tuvl-flightlog serve                              start the service
tuvl-flightlog team create NAME | code NAME | list
tuvl-flightlog developer list | approve ID_OR_EMAIL | revoke ID_OR_EMAIL
tuvl-flightlog events [--team N] [--developer D] [--kind K] [-n 30]
tuvl-flightlog export [--team N] [--since DAYS] [--format jsonl|csv] [-o FILE]
tuvl-flightlog prune --older-than DAYS [--team N] [--dry-run]
tuvl-flightlog forward status
tuvl-flightlog admin-log [-n 50]
tuvl-flightlog backup FILE                        SQLite online backup (PostgreSQL: pg_dump)
tuvl-flightlog check                              database, schema, forwarding, retention
```


## Two builds

Flightlog comes in two builds of the same contract. [**Flightlog on tuvl**](on-tuvl.md) is the service written as a tuvl
project: a worked example, and a good test of tuvl itself. Run the Python one in production.

Report a security problem to security@tuvl.io; other feedback to developer@tuvl.io. Apache License 2.0, the same as tuvl.
