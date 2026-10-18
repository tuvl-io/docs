# CLI reference

Every read command supports `--json` with a stable, documented schema (coding agents parse it;
`/dev/schema/cli` serves the schemas in dev mode). `-d/--project-dir` defaults to the current
directory everywhere.

## Project

| Command | Options | |
|---|---|---|
| `tuvl init [NAME]` | `--sample`, `--preset gemini\|openai\|anthropic\|ollama`, `--decision-model laya\|none`, `-y/--yes`, `--multi-tenant`, `--no-ai-skills` | Scaffold a project. A preset writes `llms/default.yaml` with a current model id, reading the key from the environment. `--sample` is a ticket-triage project (spec, TaskPlan, tests, lock) that passes the CI gate as created. `--decision-model laya` adds `llms/laya.yaml`, `LAYA_API_*` in `.env` and a `compose.yaml` that runs laya-serve locally (asked interactively, default no). `-y` accepts every default |
| `tuvl storage` | `check [name]`, `ls <name> [prefix]` | Check each `kind: Storage` store by writing, reading back and deleting a probe object (read-only stores are only listed), or list a store's objects. See `docs/storage.md` |
| `tuvl validate` | `--strict`, `--json` | Contracts, data flow, types, policy, artifacts, lock; prints each workflow's determinism profile and worst-case tokens. `--strict` fails on warnings. Ends with **needs models**: every model the workflows use, its provider and the environment variables it reads (or "no LLM required"); V028 = unknown model reference, V029 = undeclared credentials (an error at ship time) |
| `tuvl codegen [WORKFLOW]` | `--check` | Schemas, code-agent stubs (body-preserving merge), prompt placeholders, spec tests. `--check` writes nothing and exits 1 on drift |
| `tuvl lock` | `--check`, `--mcp/--no-mcp` | Pin model ids, artifact hashes, judge/decision models and MCP tool schemas in `tuvl.lock` |
| `tuvl doctor` | `--live`, `--json` | Are the project's models configured? Lists each model, the variables it needs and which are missing (exit 1 if any). `--live` makes one minimal call per model (a few tokens; Laya/Jev: their `/health`). A production server runs the same check at startup and refuses to start on a missing variable; `/health` reports each model's readiness |
| `tuvl test` | `--live`, `--allow-uncertain`, `--strict`, `-k/--only TEXT`, `--json` | Run `Test` documents offline (`--live` lets unmocked model/tool agents call out). Results are PASS, **STUBBED** (expectations met only through unmocked `pending` placeholders — not counted) or FAIL; `--strict` (CI) also fails on stubbed results and untrusted judge calibration |
| `tuvl project info` | `--json` | The project's identity from `.tuvl/project.yaml`: the immutable, self-checking id (`prj_<uuidv7>-<2 check characters>`, minted by `tuvl init`; the check catches typos and hand edits, it is not a signature), name, author, email, type (`poc\|dev\|production`), version, registry status. Also editable in Insight → Settings → Project. Full reference: [project](project.md) |
| `tuvl project init` | `--name`, `--new-id` | Create `project.yaml` for a project that predates it. Never changes an existing id; `--new-id` replaces a malformed or copied id and clears its registration |
| `tuvl project set FIELD VALUE` | | Update `name`, `author`, `email`, `type`, `version`, `description`, `license` or `repo` (validated). The description is Markdown (up to 2000 characters): `VALUE` of `@about.md` reads a file, `-` reads stdin; `project info` renders it |
| `tuvl project register` | `--hub URL`, `--public-email`, `-y` | List the project in the public catalogue. Prints the exact payload first and asks `Send this? [y/N]` (answer `n` to only look: nothing is sent and no login starts); signs in with GitHub's device flow; the email is sent only with `--public-email`. Also available as Insight → Settings → Project → Register / Update listing (same payload preview and login) |
| `tuvl skills update` | `--diff` | Refresh `AGENTS.md` and `.agents/skills/` to this tuvl version (removes 1.x skills; mirrors to `.claude/skills/`) |

## Specs

| Command | Options | |
|---|---|---|
| `tuvl spec verify [SPEC_FILE…]` | `--strict`, `--no-tests`, `--json` | Does the implementation match the spec? Zero tokens; rules R001–R010 and a traceability matrix (step → agent → tests). Exits 1 on a mismatch (`--strict`: also on unfinished work) |
| `tuvl spec new NAME` | `--owner`, `--workflow` | Write `specs/<name>.md` from the template |
| `tuvl spec check [SPEC_FILE…]` | `--strict`, `--json` | Is the spec complete and consistent? Zero tokens; rules S001–S016 with line numbers, plus P001–P005 on its task list ([spec-driven](spec-driven.md#2-check-it)). Exits 1 on a blocking finding (`--strict`: on warnings too) |
| `tuvl spec status [SPEC_FILE]` | `--strict`, `--no-tests`, `--json` | Derived task statuses. `--strict` exits 1 unless every live task is done and none is blocked or stale |
| `tuvl spec diff [SPEC_FILE]` | `--json` | Stale tasks and spec sections no task covers |

## Servers

| Command | Options | |
|---|---|---|
| `tuvl dev` | `-p/--port` (8885), `--auto-login`, `--show-key`, `--no-browser`, `-H/--allow-host` | Dev server with Insight and the dev API, reloading on YAML changes. The session key is stored in `.tuvl/.dev-session` (0600); `--show-key` prints it |
| `tuvl run` | `-p/--port`, `--host`, `-w/--workers`, `--role all\|api\|worker`, `-c/--concurrency` (8), `-H/--allow-host` | Production server. `api` serves HTTP and runs synchronous requests inline; `worker` executes the queue |
| `tuvl mcp` | `--allow-write` | Dev tools for coding agents over MCP (stdio); `--allow-write` adds `codegen_write`, `run_workflow`, `pin_fixture`. Refuses production |

## Runs

These talk to a running server: `-u/--url` (`TUVL_URL`, default `http://localhost:8885`) and
`-t/--token` (`TUVL_TOKEN`, needs `runs:read`).

| Command | Options | |
|---|---|---|
| `tuvl runs list` | `-w/--workflow`, `-s/--status`, `-n/--limit`, `--json` | Recent runs, newest first |
| `tuvl runs get RUN_ID` | | One run as JSON |
| `tuvl runs tail [RUN_ID]` | `-w/--workflow`, `-p/--payload JSON` | Follow a run's events until it ends (or start one with `--workflow`); exits 1 if it fails |
| `tuvl runs pin RUN_ID` | `-n/--name` | Export the journal to `tests/fixtures/<workflow>/<name>.journal.json` |
| `tuvl runs replay FIXTURES…` | `--json` | Re-run pinned journals offline; fail if the end or output differ |

## Shipping and operations

| Command | Options | |
|---|---|---|
| `tuvl ship` | `-t/--tag`, `--no-build`, `--push`, `--force`, `--strict`, `--extra`, `--with-laya/--without-laya` | Gate (validate, no `pending` agents — V010 is an error at ship time, current lock), then `.dockerignore` as an **allowlist** (only models, workflows, agents, artifacts, datasources, llms, federation, config, lock and `.tuvl/system.yaml` / `telemetry.yaml` enter the image; specs, task lists, tests, agent rules and skills, compose files and anything else stay out — V027 refuses development files), `deploy/Dockerfile` (pins the locked tuvl version and installs only the extras the project uses: `mcp` for `use: mcp` tools, loop MCP servers and MCP export, `redis` for a redis datasource, `vector` for collections and `tuvl.data_*`, `otel-grpc` for `otlp_protocol: grpc`; it also stops when `agents/*.py` imports a package `pyproject.toml` does not declare. `--extra NAME` adds one the scan cannot see; the choice is recorded as the image label `io.tuvl.extras`) and a Helm chart (`split: true` for api + worker Deployments; a Laya Deployment + Service, with `LAYA_API_BASE` set for the engine, when a model uses `provider: laya` or with `--with-laya` — `laya.enabled` in values.yaml) and `docker build` |
| `tuvl deploy` | `-d/--project-dir` | Coming soon: deploy to a hosted, managed tuvl engine that runs your backend services. Today it prints a message, deploys nothing and exits 1 |
| `tuvl keys generate` | `-w/--write`, `-f/--force` | A persistent Ed25519 key for signing access tokens (`TUVL_SIGNING_KEY`) |
| `tuvl db generate-rls` | `-o/--out` | Idempotent row-level-security SQL for tenant-scoped tables |
| `tuvl db check-rls` | | Exit 1 if a tenant-scoped table lacks its RLS policy |

### Extras: what an image installs

`tuvl` installs lean. Features with their own packages are extras, and `tuvl ship` reads the project and
installs `tuvl[<only those>]==<locked version>`:

| Extra | Package | `tuvl ship` installs it when |
|---|---|---|
| `mcp` | `mcp` | a `use: mcp` tool, a loop `mcp` tool, or a workflow with `trigger.mcp.enabled` |
| `redis` | `redis` | a `kind: DataSource` with `type: redis`, or `agents/*.py` imports `redis` |
| `vector` | `pgvector` | a Collection or Embedding document, `tuvl.data_search` / `tuvl.data_ingest`, or an import of `pgvector` |
| `otel-grpc` | OTLP gRPC exporter | `.tuvl/telemetry.yaml` has `otlp_protocol: grpc` |
| `codegen`, `test` | `libcst`, `aiosqlite` | never: `tuvl codegen`, `tuvl init --sample` and `tuvl test` are development tools |

`tuvl[standard]` installs Insight and every extra, so a development install needs nothing else. The
model providers and blob storage (S3, Azure, GCS, local) are part of `tuvl` and need no extra.

`tuvl ship` prints the extras it chose and why and records them as the image label `io.tuvl.extras`
(`docker inspect` shows what an image carries). Beyond the extras:

- It also scans `agents/*.py`: an import of a package that `pyproject.toml` does not declare aborts the ship,
  because the image would fail at run time. Declared packages that no agent imports are listed and kept.
- `--extra NAME` adds an extra the scan cannot see, for example a feature switched on by an environment
  variable. It accepts `mcp`, `redis`, `vector` and `otel-grpc`.
- A kept `deploy/Dockerfile` (no `--force`) that lacks an extra the project now needs stops the ship.
- Using a feature without its extra fails with `pip install 'tuvl[name]'`; the same message appears for
  `tuvl codegen`, `tuvl test` and `tuvl mcp` on a bare install.
- `tuvl deploy` is for managed hosting and is not available yet: it prints a message and exits 1.
  Until then, install the chart `tuvl ship` writes with `helm`.

## The CI gate

```bash
tuvl spec check && tuvl validate --strict && tuvl codegen --check && tuvl lock --check && tuvl test --strict && tuvl spec verify --strict && tuvl spec status --strict
```
