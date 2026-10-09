# Example projects

The [tuvl-io/examples](https://github.com/tuvl-io/examples) repository holds complete tuvl 2.0
projects. Each runs with `tuvl dev`, passes `tuvl validate --strict`, and can be tried in a browser
sandbox at [try.tuvl.online](https://try.tuvl.online).

| Example | What it shows | Engines |
|---|---|---|
| **sentiment-api** | Classify a product review and persist it — the smallest useful workflow | `llm`, `tool` (db) |
| **invoice-extraction-api** | Extract a structured invoice from text, verify it deterministically, persist it; per-signal outputs (valid / mismatch / incomplete) | `llm`, `code`, `tool` |
| **content-moderation-pipeline** | Classify user content, apply region policy in code, notify a channel, and send borderline items to a person | `llm`, `code`, `tool` (http), `human` |
| **knowledge-base-qa** | Retrieval-augmented answers with citations on the built-in vector rails | `code` (`tuvl.data_ingest`, `tuvl.data_search`), `llm` |
| **support-triage** | Rules-first triage (`decide`), an investigating `loop` with a supervisor, and a tool call that needs approval before issuing a credit (a child workflow) | `decide`, `loop`, `llm`, `tool`, `code` |
| **mcp-research-agent** | A bounded `loop` driving an MCP fetch server (allow-listed tools, schema pinned in `tuvl.lock`) to write a cited brief | `loop`, `tool` (mcp), `llm`, `code` |
| **kyc-onboarding** | PII-safe intake (`secure: true`), sanctions screening, a supervised investigation `loop` with a calibrated **judge**, and a compliance officer's decision | `loop`, `human`, `llm`, `tool`, `code` |

```bash
git clone https://github.com/tuvl-io/examples && cd examples/support-triage
cp .env.example .env            # add a model key and Postgres settings
tuvl validate --strict
tuvl dev --auto-login
```
