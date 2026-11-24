<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

# Security


Flightlog holds a record of what developers do. It is small on purpose, and this page says what it protects, what it does not, and
what to do when you run it.

## What it protects

- **Identity.** A developer's identity is whoever holds their token. The server decides who that is. Whatever an event says about
  its actor is stored apart (`claimed`) and never used to attribute it.
- **Tokens and join codes** are random and stored only as SHA-256 hashes. A token is shown once, at registration or rotation.
  Revoking a developer kills their token at once; rotating gives a new one and kills the old.
- **Isolation.** A developer reads only their own team's events.
- **No admin over the network.** There is no admin endpoint, no web UI and no interactive API page. Teams, approval, revocation,
  export, prune and backup are commands run on the server, so reaching the service from outside gives no way to administer it.
  Everything an administrator does is in the admin log.
- **Small, bounded input.** Four developer endpoints, JSON only, at most 1 MB and 200 events a batch, field lengths capped,
  per-developer and per-address rate limits, join-code guessing throttled.
- **Hardened responses.** `nosniff`, `no-store`, `no-referrer`, a deny-all content security policy, HSTS when https is on, no
  `Server` or `Date` header.
- **The container** runs as a non-root user, works with a read-only filesystem and no capabilities.

## What it does not do

- **It does not make the events true.** They are what each developer's tuvl reports about itself: good for visibility across a
  team, not tamper-proof evidence. For an audit, rely on what the git host and CI record.
- **Registration trusts the join code.** Anyone with a team's join code can register under any name and email that is not already
  taken. Treat the join code like a password, rotate it (`team code`) when someone leaves, and use `--require-approval` when you
  want an administrator to confirm each developer. Single sign-on, which removes shared codes, is a later feature.
- **Tokens live on developers' machines** (in their own config folder, readable only by them). Revoke on loss; rotate on a schedule.
- **Rate limits are per process.** With several replicas the limits add up; put a limit at your proxy or ingress as well (the
  examples do).
- **It does not encrypt data at rest.** Use disk or database encryption, and restrict who can read the database file or schema.

## Hardening checklist

1. **Always https.** Terminate TLS at your proxy or ingress, or use `--tls-cert/--tls-key`. tuvl refuses a non-https server except
   `localhost`. For a private CA, developers set `TUVL_DEV_TELEMETRY_CA` (or `SSL_CERT_FILE`) to the CA bundle.
2. **Expose only `/health` and `/v1/*`.** `/ready` and `/metrics` belong inside your network (the Caddy, nginx and Kubernetes
   examples do this).
3. **Use PostgreSQL** with a user that owns only the Flightlog database; keep its password in the environment or a secret.
4. **Behind a proxy**, set `--forwarded-allow-ips` to the proxy's address so rate limits see the real client.
5. **Keep the metrics token off** unless you scrape; when on, treat it as a secret.
6. **Retention.** Decide how long to keep events and set `FLIGHTLOG_RETENTION_DAYS`; forward to your archive if you need longer.
7. **Restrict the server.** Only administrators should have a shell where `tuvl-flightlog` can run against the database; that is the
   whole admin surface.
8. **Review the admin log** (`tuvl-flightlog admin-log`) and forward events to your SIEM.
9. **Back up** the database and test a restore.
10. **Keep it patched.** Watch for releases; roll them one replica at a time.
