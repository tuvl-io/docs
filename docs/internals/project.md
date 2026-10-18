# Project identity and the catalogue

Every project made by `tuvl init` carries `.tuvl/project.yaml`: who built it, what it is, and a
stable id. A project can optionally be listed in the public catalogue (hub.tuvl.io). **Nothing is
sent anywhere unless you register**, and registering always shows you the exact payload first.

## In five minutes

```bash
tuvl init refund-approvals -y        # writes .tuvl/project.yaml, with an id and your git identity
cd refund-approvals
tuvl project info                    # what the project says about itself
tuvl project set type poc
tuvl project set description "Refund approvals: small refunds at once, large ones wait for a lead."
tuvl project register                # shows the payload and asks; answer n to only look
```

```text
id        prj_01a14ef6-ec7c-7ab3-8478-07b546f17859-dp
name      refund-approvals
author    Jane Doe
email     jane@example.com
type      poc
version   0.1.0
license   —
repo      —
registry  not registered
```

```text
$ tuvl project register
Registering with https://hub.tuvl.io:
{
  "id": "01a14ef6-ec7c-7ab3-8478-07b546f17859",
  "name": "refund-approvals",
  "author": "Jane Doe",
  "type": "poc",
  "version": "0.1.0",
  "description": "Refund approvals: small refunds at once, large ones wait for a lead.",
  "license": "",
  "repo": "",
  "tuvl_version": "2.0.0b5"
}
Send this? [y/N]:
```

Answering `n` (the default) exits with status 1 and has sent nothing. It does not even sign in, so it
is a safe way to see what a listing would say.

## The file

```yaml
kind: Project
version: v1
metadata:
  name: screening
spec:
  id: prj_01a141a1-9446-74f6-81e4-bc37135cfcf1-f8
  author: Jane Doe
  email: jane@example.com
  type: dev                # poc | dev | production
  version: 0.1.0           # the app's own semver, not the engine's
  description: |
    Screens **candidate** applications.

    - scores CVs
    - routes edge cases to a human
  license: Apache-2.0             # optional
  repo: https://github.com/acme/screening
  registry:                # written by register, not by hand
    url: https://hub.tuvl.io
    id: prj_01a141a1-9446-74f6-81e4-bc37135cfcf1-f8
    registered_at: 2026-10-15T10:00:00Z
    public_email: false
    digest: 3f9a1c0b7d2e4a55
```

| Field | Rules |
|---|---|
| `id` | Minted once by `tuvl init`; never changes. `prj_` + a UUIDv7 + two check characters |
| `name` | Required |
| `type` | `poc`, `dev` or `production` |
| `version` | Semver (`1.2.3`, `1.2.3-rc.1`) |
| `email` | Valid address if set; private unless you register with `--public-email` |
| `description` | **Markdown**, up to 2000 characters |
| `repo` | `http(s)` URL if set |

The file is read fail-open: a project without it boots normally and `tuvl project init` creates it.

### Fields and rules

| Field | Rules | Message when refused |
|---|---|---|
| `id` | Minted once by `tuvl init`; never changes. `prj_` + a UUIDv7 + two check characters. Not editable | |
| `name` | Required | `name must not be empty` |
| `author` | Free text. **Public** in a listing | |
| `email` | Valid address if set. Private unless you register with `--public-email` | `email is not a valid address` |
| `type` | `poc`, `dev` or `production` | `type must be one of: poc, dev, production` |
| `version` | Semver (`1.2.3`, `1.2.3-rc.1`): the application's own version, not the engine's | `version must be semver, e.g. 0.1.0` |
| `description` | **Markdown**, up to 2000 characters; a safe subset is rendered (no raw HTML, http(s) links only) | `description is limited to 2000 characters` |
| `license` | Optional free text, for example `Apache-2.0`. Your project's license is your choice; `tuvl init` writes none | |
| `repo` | `http(s)` URL if set | `repo must be an http(s) URL` |

The file is read fail-open: a project without it boots normally and `tuvl project init` creates it.

### Where author and email come from

`tuvl init` fills `author` and `email` from `git config user.name` and `git config user.email`, and
leaves them empty when git has none. **Check them before you register**: the author name is shown
publicly, so use the name you want credited. Change either with `tuvl project set author "…"` or in
Insight. The email is never published unless you ask for it.

### The id is self-checking

The two trailing characters are derived from the UUID. A typo or a half-edited id fails the check
and every `tuvl project` command, Insight and register refuse it. This guards against accidents and
copy-paste damage; it is **not a signature**: anyone can recompute the check. Ownership of a
listing is decided by the hub, which ties an id to the GitHub account that registered it first.

A copied project shares its id with the original. Run `tuvl project init --new-id` in the copy to
mint its own (this also clears the registration).

## Command line

```bash
tuvl project info [--json]            # the record; the description is rendered as Markdown
tuvl project set FIELD VALUE          # name author email type version description license repo
tuvl project set description @about.md          # read from a file
cat README.md | tuvl project set description -  # or stdin
tuvl project init [--name N] [--new-id]
tuvl project register [--hub URL] [--public-email] [-y]
```

All of them take `-d/--project-dir` (default: the current directory).

| Command | Does | Exit status |
|---|---|---|
| `info` | Prints the record and the registry state. `--json` prints the record as JSON | 1 if there is no `project.yaml` or the id fails its check |
| `set` | Validates and writes one field, then prints `✓ <field> updated` | 2 if the value is refused or `@FILE` cannot be read |
| `init` | Creates `project.yaml` for a project that predates it, with your git identity. Never changes an existing id | |
| `init --new-id` | Mints a new id for a copied project and clears its registration (asks first if it was registered) | 1 if declined |
| `register` | Shows the payload, asks, signs in if needed, registers | 1 if declined or refused |

### Registry state

`info` ends with the listing state:

| Shown | Means | Do this |
|---|---|---|
| `not registered` | Never listed | `tuvl project register` when you want to |
| `<hub> · <date> · up to date` | The listing matches the file | Nothing |
| `changed since last registration — run tuvl project register` | You edited a field after registering | Register again to update the listing |
| `id differs from the registered one — run tuvl project register` | The id changed (for example `--new-id`) | Register again; it is a separate listing |

## Registering

```bash
tuvl project register
```

1. **Preview.** The CLI prints `Registering with <hub>:` and the payload, then `Send this? [y/N]:`.
    Nothing has left your machine yet. `-y` skips the question. `--public-email` adds your email to
    the payload (and you will see it there before you confirm).

2. **Sign in.** The hub identifies you by GitHub. If this machine has no saved login, the CLI prints a
    short code and a URL (it also tries to open the browser):

    ```text
    Open https://github.com/login/device and enter ABCD-1234
    ```

    Enter the code on that page while signed in to the GitHub account that should own the listing,
    and approve. The CLI waits until you do (the code expires; run the command again if it did). This
    is GitHub's device flow, so no password or secret goes through tuvl. The token is cached in
    `~/.config/tuvl/hub.json` (mode 0600; `$XDG_CONFIG_HOME` is honoured) and reused next time.

3. **Register.** On success the CLI prints `✓ Registered prj_…` and writes a `registry:` block into
    `project.yaml` (hub URL, id, time, whether the email is public, and a digest of what was listed).
    That is how `info` later knows whether the listing is current. Commit it with the file.

The listing belongs to the GitHub account that registered the id first. Only that account can update
it, by running `tuvl project register` again after changing a field. There is no command to unlist
or transfer a listing yet.

**Copied a project?** A copy shares the original's id. Run `tuvl project init --new-id` in the copy
before registering, or you would be updating the original's listing.

### If it does not work

| You see | It means | Do this |
|---|---|---|
| `No .tuvl/project.yaml here. Run tuvl project init.` | The project predates the file | `tuvl project init` |
| `The project id … is malformed or was edited by hand.` | The id fails its check | Restore it from version control, or `tuvl project init --new-id` |
| `the hub refused the login request (501)` | The hub has no GitHub sign-in configured. Its catalogue is readable, but nobody can register | Try again later, or use `--hub` with another hub. See below |
| `login timed out; run the command again` | The device code expired before you approved it | Run it again and approve sooner |
| `login failed: …` | GitHub or the hub refused the login | Run it again; check the account you approved with |
| `could not reach <hub>: …` | Network or the hub is down | Retry later; check `TUVL_HUB_URL` if you set it |
| `The hub rejected the registration: …` | The hub refused the payload or the account is not the id's owner | Read the reason; fix the field, or register from the owning GitHub account |
| A 401 from the hub | The saved token expired | The CLI signs in again once by itself |

### Running your own hub

The hub is an ordinary tuvl project. Point the CLI at one with `--hub https://hub.example.com` or `TUVL_HUB_URL`. A hub needs a GitHub OAuth app (callback
`https://<hub>/auth/oauth/github/callback`, **Enable Device Flow** ticked) with its client id and secret
in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Without them it serves the catalogue read-only and
answers `501` to sign-in, which is the message above.

## Insight

**Settings → Project** edits every field above. The description has an Edit / Preview toggle.

The **Catalogue** card shows the listing state and a **Register** button (**Update listing** once
listed, and the card says when the project changed since). The dialog shows the exact payload and a
"show my developer email publicly" checkbox. **Send** registers directly when this machine already
has a hub login; otherwise it shows a GitHub device code, waits for approval and then registers.
The hub token stays on the dev server and is shared with the CLI's cache.

## What registration sends

```json
{
  "id": "01a141a1-9446-74f6-81e4-bc37135cfcf1",
  "name": "screening", "author": "Jane Doe", "type": "dev", "version": "0.1.0",
  "description": "…", "license": "Apache-2.0", "repo": "https://…", "tuvl_version": "2.0.0b5"
}
```

plus `contact_email` only with `--public-email` (or the checkbox). The hub keys the entry by the
bare UUID; the check characters never leave your machine. Nothing about your workflows, models, data
or `.env` is sent.

| Field | Public in the listing? |
|---|---|
| `name`, `author`, `type`, `version`, `description`, `license`, `repo`, `tuvl_version` | Yes |
| `id` (the bare UUID) | Yes, it is the listing's key |
| `email` | **No**, unless you register with `--public-email` |
| Your GitHub account | Recorded by the hub as the owner of the listing |

Sign-in is GitHub's device flow (see [auth](auth.md)). The hub is `https://hub.tuvl.io`, or
`TUVL_HUB_URL` / `--hub` for a self-hosted one.

## Dev API (Insight)

Served by `tuvl dev` only; not mounted in production.

| Route | |
|---|---|
| `GET /dev/project` | the record plus `registration_state` (404 if the project has none) |
| `PUT /dev/project` | update editable fields; the id and registry block are ignored |
| `POST /dev/project/register/preview` | the payload that would be sent |
| `POST /dev/project/register` | register, or start a device login (`status: login_required`) |
| `POST /dev/project/register/poll` | `pending` until approved, then registers |
