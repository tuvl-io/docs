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

## Only what the project uses

The image holds `tuvl` plus the extras your project needs and nothing else. `tuvl ship` decides from
files, before the build, so the same project always produces the same image:

| Extra | Installed when |
|---|---|
| `mcp` | a `use: mcp` tool, a `loop` MCP server, or a workflow with `trigger.mcp.enabled` |
| `redis` | a `kind: DataSource` with `type: redis`, or an agent imports `redis` |
| `vector` | a Collection or Embedding document, `tuvl.data_search` / `tuvl.data_ingest`, or an agent imports `pgvector` |
| `otel-grpc` | `.tuvl/telemetry.yaml` sets `otlp_protocol: grpc` |

`codegen` and `test` are development tools and never enter an image. Blob storage and every model
provider are part of `tuvl` and add nothing. A project with none of the triggers above ships the bare
install, about 65 MB of Python packages instead of the 320 MB of 2.0.0b4.

```text
✓ tuvl extras: mcp
    mcp: workflows/triage.yaml: agent lookup calls an MCP server
  not installed: redis, vector, otel-grpc
```

- **Your own packages.** `tuvl ship` reads the imports in `agents/*.py`. A package that
  `pyproject.toml` does not declare stops the ship, because the container would fail mid-run;
  `uv add` it. Declared packages that no agent imports are listed and kept; remove them from
  `pyproject.toml` to slim the image.
- **What the image carries.** The chosen extras are written into `deploy/Dockerfile` as
  `tuvl[...]==<locked version>` and recorded as the image label `io.tuvl.extras`:
  `docker inspect --format '{{ index .Config.Labels "io.tuvl.extras" }}' <image>`.
- **Something the scan cannot see.** `--extra mcp` (or `redis`, `vector`, `otel-grpc`) adds an extra,
  for example for a feature an environment variable turns on.
- **A kept Dockerfile.** Generated files are kept unless you pass `--force`. If a kept
  `deploy/Dockerfile` lacks an extra the project now needs, the ship stops and says so.

## Options

| Option | Meaning |
|---|---|
| `-t`, `--tag` | Image reference. Defaults to `<project>:<version>` |
| `--no-build` | Write the Dockerfile and chart, skip `docker build` |
| `--push` | Push the image after a successful build |
| `--force` | Overwrite existing generated files |
| `--strict` | Treat validation warnings as errors |
| `--extra NAME` | Also install a tuvl extra (`mcp`, `redis`, `vector`, `otel-grpc`). Repeatable |
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

## Storage in the chart

A `kind: Storage` store on local disk gets a persistent volume and `fsGroup` in the chart. Cloud
stores (S3, Azure, GCS) need no volume, only their credentials in the secret. `storage/` is on the
image allowlist; a project shipped before storage existed needs `tuvl ship --force` once. See
[Blob Storage](../internals/storage.md).

## Coming: `tuvl deploy`

A `tuvl deploy` command is planned and is not available yet. Today you deploy the chart that
`tuvl ship` writes with `helm`, as above.

## See also

- [CLI reference](../internals/cli.md)
- [Blob Storage](../internals/storage.md)
- [AI Models](../configuration/agents.md)
- [Installation](installation.md)
