# Shipping to production

`tuvl ship` turns a project into a container image and a Helm chart, or into a runnable archive. It is the
same gate as CI: nothing ships that does not validate.

```bash
tuvl generate key --write          # a persistent signing key (TUVL_SIGNING_KEY)
tuvl ship -t registry.example.com/triage:0.1.0 --push
```

## Image, archive, or both

`--format image` (the default) builds the container image, labelled with a hash of the files the runtime
uses and the commit. `--format archive` writes a reproducible `tar.gz` (or `zip` with `--archive-format zip`)
with `run.sh`, `RUN.md`, `.env.example` and `BUILD-INFO.json`, which you run with `uv` on a host without
Docker. `--format both` does both; `--no-image` skips the image build. `--out` sets where files go.

Before either, `ship` runs the deterministic spec gate: every spec under approval is approved and unchanged,
`lint spec` and `verify spec` are clean, tasks are done (`--allow-incomplete` to override), generated files
are current, the agents' Python has no review errors, `uv.lock` is current and the tree is clean
(`--allow-dirty`).

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

`generate code` and `run tests` are development tools and never enter an image. Blob storage and every model
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

## `tuvl deploy`: deploy to a tuvl cloud

`tuvl deploy` sends the project to a hosted tuvl cloud (`https://cloud.tuvl.io` by default), which builds it and runs it in its own
container with its own database. There is no image or cluster for you to operate. It packages the project the way
`tuvl ship --format archive` does, uploads it, follows the build and the deployment, and prints the address.

It needs a **client token**, which the cloud's operator makes for your account (cloud console → Customers → your account → Deploy tokens).
A token looks like `tvc_<client id>_<secret>` and is shown once; the cloud keeps only a keyed hash, so a lost token is replaced, not recovered.

```bash
export TUVL_CLIENT_TOKEN=tvc_...                      # or: tuvl deploy --login (saved with owner-only permissions)
tuvl deploy --admin-email you@example.com             # package, upload, build, deploy
echo "$TOKEN" | tuvl deploy --token-stdin             # in CI: the token from standard input
```

The token is never an argument and never printed, and it is sent only over https (plain http only to `localhost`).

| Option | What it does |
|---|---|
| `--url URL` | The cloud to deploy to (default `https://cloud.tuvl.io`, or `TUVL_CLOUD_URL`). |
| `--plan NAME` | The plan for a new project (`hobby` or `standard`). The wallet must be able to pay it; if not, nothing is built. |
| `--hostname NAME` | The name for a new deployment (default `<project>.<the cloud's base domain>`). |
| `--admin-email EMAIL` | Create an administrator in a new app. The password is made on your machine, sealed so only the cloud can read it, and shown once at the end. `--no-admin` skips it. |
| `--archive FILE` | Deploy an archive you already made with `tuvl ship --format archive`. |
| `--login`, `--logout` | Save or forget a token on this machine. |
| `--no-follow` | Start the deployment and return; it keeps going on the cloud. |

A project name nobody owns is claimed by deploying it. A name another customer owns is refused as "not available" without saying whether it exists.

### Names: `--check-dns` and `--set-hostname`

Names are under the cloud's base domain (for example `shop.tuvl.app`), and each is served by one project.

```bash
tuvl deploy --check-dns --hostname shop.tuvl.app       # is it free, and does it point at the cloud?
tuvl deploy --set-hostname shop.tuvl.app               # serve the deployed app under this name
```

- `--check-dns` deploys nothing. It says whether the name is `available`, already **yours**, **taken** (used by another project, without saying which),
  **outside the base domain** or **invalid**, and, for a usable name, whether DNS resolves it to the cloud (`ok`, `missing` or `wrong`). A taken or unusable name
  exits with status 1; a record that does not resolve yet is only a warning, because the cloud's operator creates it once for the whole base domain.
  Without `--hostname` it checks the project's default name. `--project` picks another project (default: the name in `pyproject.toml`).
- `--set-hostname` packages and uploads nothing: the app restarts on its running release behind the new name, the old name stops working, the database is
  untouched and it costs no credits. It is refused, before anything restarts, when the name is taken, already this project's, outside the base domain or
  malformed, or when the project is not yours, not running, or stopped because its plan is unpaid. It cannot be combined with `--archive`, `--hostname` or `--admin-email`.

A customer's own domain (`app.acme.com`) is not supported yet.

To run the app yourself instead, deploy the chart that `tuvl ship` writes with `helm`, as above.

## See also

- [CLI reference](../internals/cli.md)
- [Blob Storage](../internals/storage.md)
- [AI Models](../configuration/agents.md)
- [Installation](installation.md)
