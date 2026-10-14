# Shipping to production

`tuvl ship` turns a project into a container image and a Helm chart. It is the same gate as CI:
nothing ships that does not validate.

```bash
tuvl keys generate --write          # a persistent signing key (TUVL_SIGNING_KEY)
tuvl ship -t registry.example.com/triage:1.0.0 --push
```

## What it does

1. **Gate.** Runs the validation (`--strict` also fails on warnings). A workflow with a `pending`
   agent (V010) is an error at ship time, and the project's `tuvl.lock` must be current.
2. **Deploy artifacts.** Writes `deploy/Dockerfile` (pinned to the locked tuvl version),
   `.dockerignore` and a chart in `deploy/chart/<name>/`. Existing files are kept unless you pass
   `--force`.
3. **Image.** Runs `docker build`, and `docker push` with `--push`.

The `.dockerignore` is an **allowlist**: only models, workflows, agents, artifacts, datasources,
llms, federation, config, the lock and `.tuvl/system.yaml` / `telemetry.yaml` enter the image.
Specs, task lists, tests, agent rules and skills, compose files and `.env` stay out; a
development file in the image is refused (V027).

The container runs in production mode: no dev routes, no Insight UI, JSON logs, telemetry on.

## Options

| Option | Meaning |
|---|---|
| `-t`, `--tag` | Image reference. Defaults to `<project>:<version>` |
| `--no-build` | Write the Dockerfile and chart, skip `docker build` |
| `--push` | Push the image after a successful build |
| `--force` | Overwrite existing generated files |
| `--strict` | Treat validation warnings as errors |
| `--with-laya` / `--without-laya` | Include the Laya decision server in the chart. Default: on when an AgentModel uses `provider: laya` |

## Deploy

```bash
kubectl create secret generic triage-env --from-env-file=.env
helm install triage deploy/chart/triage --set image.repository=registry.example.com/triage
```

The secret must hold `TUVL_SIGNING_KEY`, `POSTGRES_PASSWORD` and the variables of every model the
workflows use. A production engine refuses to start while one is missing.

For separate API and worker pods:

```bash
helm install triage deploy/chart/triage --set split=true --set worker.replicaCount=3
```

## Laya in the chart

When a model uses `provider: laya` (or with `--with-laya`), the chart gains a Laya Deployment and
Service, and the engine's `LAYA_API_BASE` points at it. `laya.enabled` in `values.yaml` switches it.

| | `model: english` | `auto` / `multilingual` |
|---|---|---|
| Image | `docker.io/tuvl/laya-serve:<version>-en` | `docker.io/tuvl/laya-serve:<version>` |
| Memory request / limit | 2 Gi / 3 Gi | 4 Gi / 5 Gi |

`tuvl ship` chooses the image and memory from your models. Set `LAYA_API_KEY` in the secret to
require a bearer key on the server. Leave Laya out with `--without-laya` (or `--set laya.enabled=false`)
when you use a hosted model instead.

## Redis

The chart does not include Redis. Run more than one worker (`split=true`, or several replicas) and
you need one: point a `type: redis` datasource at it with `REDIS_HOST`, `REDIS_PORT` and
`REDIS_PASSWORD`. See [Redis configuration](../configuration/redis.md).

## See also

- [CLI reference](../internals/cli.md)
- [AI Models](../configuration/agents.md)
- [Installation](installation.md)
