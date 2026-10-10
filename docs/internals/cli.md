# CLI reference

Every read command supports `--json` with a stable, documented schema (coding agents parse it;
`/dev/schema/cli` serves the schemas in dev mode). `-d/--project-dir` defaults to the current
directory everywhere.

## Project

| Command | Options | |
|---|---|---|
| `tuvl init [NAME]` | `--sample`, `--preset gemini\|openai\|anthropic\|ollama`, `--decision-model laya\|none`, `-y/--yes`, `--multi-tenant`, `--no-ai-skills` | Scaffold a project. A preset writes `llms/default.yaml`, `llms/analysis.yaml` and `config.yaml` with current model ids, reading the key from the environment. `--sample` is a ticket-triage project (spec, TaskPlan, tests, lock) that passes the CI gate as created. `--decision-model laya` adds `llms/laya.yaml`, `LAYA_API_*` in `.env` and a `compose.yaml` that runs laya-serve locally (asked interactively, default no). `-y` accepts every default |
| `tuvl validate` | `--strict`, `--json` | Contracts, data flow, types, policy, artifacts, lock; prints each workflow's determinism profile and worst-case tokens. `--strict` fails on warnings |
| `tuvl codegen [WORKFLOW]` | `--check` | Schemas, code-agent stubs (body-preserving merge), prompt placeholders, spec tests. `--check` writes nothing and exits 1 on drift |
| `tuvl lock` | `--check`, `--mcp/--no-mcp` | Pin model ids, artifact hashes, judge/decision models and MCP tool schemas in `tuvl.lock` |
| `tuvl test` | `--live`, `--allow-uncertain`, `--strict`, `-k/--only TEXT`, `--json` | Run `Test` documents offline (`--live` lets unmocked model/tool agents call out); `--strict` fails on untrusted judge calibration |
| `tuvl skills update` | `--diff` | Refresh `AGENTS.md` and `.agents/skills/` to this tuvl version (removes 1.x skills; mirrors to `.claude/skills/`) |

## Specs

| Command | Options | |
|---|---|---|
| `tuvl spec new NAME` | `--owner`, `--workflow` | Write `specs/<name>.md` from the template |
| `tuvl spec analyse SPEC_FILE` | `-m/--model`, `--apply`, `--only PATHS`, `--json` | Plan with the analysis model (dry run, validate-gated, saved to `.tuvl/analysis/`); `--apply` writes the saved plan without a model call |
| `tuvl spec status [SPEC_FILE]` | `--strict`, `--no-tests`, `--json` | Derived task statuses. `--strict` exits 1 unless every live task is done and none is blocked or stale |
| `tuvl spec diff [SPEC_FILE]` | `--json` | Stale tasks and spec sections no task covers |

## Servers

| Command | Options | |
|---|---|---|
| `tuvl dev` | `-p/--port` (8885), `--auto-login`, `--show-key`, `--no-browser`, `-H/--allow-host` | Dev server with Insight and the dev API, reloading on YAML changes. The session key is stored in `.tuvl/.dev-session` (0600); `--show-key` prints it |
| `tuvl run` | `-p/--port`, `--host`, `-w/--workers`, `--role all\|api\|worker`, `-c/--concurrency` (8), `-H/--allow-host` | Production server. `api` serves HTTP and runs synchronous requests inline; `worker` executes the queue |
| `tuvl mcp` | `--allow-write` | Dev tools for coding agents over MCP (stdio); `--allow-write` adds `spec_apply`, `codegen_write`, `run_workflow`, `pin_fixture`. Refuses production |

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
| `tuvl ship` | `-t/--tag`, `--no-build`, `--push`, `--force`, `--strict`, `--with-laya/--without-laya` | Gate (validate, no `pending` agents, current lock), then `deploy/Dockerfile` (pins the locked tuvl version) and a Helm chart (`split: true` for api + worker Deployments; a Laya Deployment + Service, with `LAYA_API_BASE` set for the engine, when a model uses `provider: laya` or with `--with-laya` — `laya.enabled` in values.yaml) and `docker build` |
| `tuvl keys generate` | `-w/--write`, `-f/--force` | A persistent Ed25519 key for Biscuit tokens (`TUVL_BISCUIT_PRIVATE_KEY`) |
| `tuvl db generate-rls` | `-o/--out` | Idempotent row-level-security SQL for tenant-scoped tables |
| `tuvl db check-rls` | | Exit 1 if a tenant-scoped table lacks its RLS policy |

## The CI gate

```bash
tuvl validate --strict && tuvl codegen --check && tuvl lock --check && tuvl test && tuvl spec status --strict
```
