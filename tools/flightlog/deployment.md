<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

# Deployment


Pick one. All of them put https in front of Flightlog and PostgreSQL behind it.

## Docker Compose (PostgreSQL and automatic https)

`deploy/docker-compose.yml` runs PostgreSQL, Flightlog and Caddy, which gets and renews a certificate for your domain by itself.

```bash
cd deploy
cp .env.example .env            # set FLIGHTLOG_DOMAIN and FLIGHTLOG_DB_PASSWORD
docker compose up -d --build
docker compose exec flightlog tuvl-flightlog team create payments      # the join code, once
docker compose exec flightlog tuvl-flightlog check
```

The Flightlog container runs as a non-root user with a read-only filesystem and no capabilities; only Caddy is published, and it
forwards `/health` and `/v1/*` only. Edit `deploy/flightlog.example.yaml` to add forwarding; mount it as shown.

## Kubernetes

`deploy/kubernetes/flightlog.yaml` is a Deployment (two replicas, probes on `/ready` and `/health`, hardened security context), a Service
and an Ingress with TLS, rate limiting and a 1 MB body limit. Create the database secret first (the file's header shows how), point
the image at your registry, and `kubectl apply -f`. Create teams with
`kubectl exec deploy/flightlog -- tuvl-flightlog team create payments`.

## nginx (or any proxy) in front of a service you run yourself

`deploy/nginx.conf` terminates TLS, limits requests and exposes only `/health` and `/v1/`. Run Flightlog on the same host:

```bash
export FLIGHTLOG_DATABASE_URL=postgresql://flightlog:PASSWORD@localhost/flightlog
tuvl-flightlog serve --host 127.0.0.1 --port 8800 --forwarded-allow-ips 127.0.0.1 --retention-days 365
```

Run it under systemd (`Restart=always`, a dedicated user, `NoNewPrivileges=yes`, `ProtectSystem=strict`,
`ReadWritePaths=` only where a file sink writes) with the environment in a file only that user can read.

## Flightlog terminating TLS itself

`tuvl-flightlog serve --tls-cert fullchain.pem --tls-key privkey.pem --host 0.0.0.0 --port 443` (a port below 1024 needs the
capability or a redirect). Fine for a small installation; a proxy gives you certificate renewal, request limits and logs.

## Pointing developers at it

```bash
tuvl set dev-telemetry https://flightlog.example.com     # commit .tuvl/dev-telemetry.yaml
tuvl register developer                              # each developer, once
```

A private certificate authority: each developer sets `TUVL_DEV_TELEMETRY_CA=/path/to/ca.pem` (or `SSL_CERT_FILE`).
