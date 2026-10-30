<div class="tool-logo"><img src="../../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

# Forwarding events to other systems


A company usually wants the events in its SIEM, its data warehouse or its log pipeline as well. Flightlog passes every event on to the
**sinks** an administrator lists in the settings file (`--config` / `FLIGHTLOG_CONFIG`). Developers cannot add or change a sink.

```yaml
forward:
  - name: siem
    type: webhook
    url: https://siem.example.com/ingest
    secret_env: FLIGHTLOG_SIEM_SECRET         # HMAC-SHA256 of the body in X-Flightlog-Signature, if set
    bearer_env: FLIGHTLOG_SIEM_TOKEN          # Authorization: Bearer <token>, if set
    ca_file: /etc/ssl/company-ca.pem      # your own certificate authority, if needed
  - name: logs
    type: file
    path: /var/log/flightlog/events.jsonl     # one JSON object per line; point Fluent Bit, Vector or Filebeat at it
```

## How delivery works

- Each sink has a **cursor** in the database: the sequence number of the last event it was given. Events are sent oldest first, in
  batches of up to 200, and the cursor moves only after the sink accepted the batch.
- That makes delivery **at-least-once** and **crash-safe**: a restart resumes where it stopped, and a sink that is down falls
  behind and catches up. Receivers should de-duplicate on `event.id` (a ULID) together with `team`.
- A failing sink backs off (up to a minute) and does not hold up the others or the developers.
- `tuvl-flightlog forward status` shows, per sink, how far it has got and how many events wait.

## The webhook

`POST` with `Content-Type: application/json` and
`{"schema": "tuvl.flightlog-events/1", "sink": "siem", "events": [ ... ]}`. Each event is the object described in
[api.md](api.md) plus `seq` (Flightlog's own order). Answer any 2xx to accept; anything else is retried. https only (plain http only for
`localhost`), no credentials in the URL, no redirects followed, no proxy settings used. Verify the signature before trusting a
body: `sha256=` followed by the hex HMAC-SHA256 of the raw body with the shared secret.

## The file

JSON lines, appended; the directory must exist and be writable by the Flightlog user. Rotate the file with your usual tools (logrotate
with `copytruncate`, or let the shipper do it). Because delivery is at-least-once, a restart can repeat the last batch.
