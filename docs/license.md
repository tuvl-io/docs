# License

tuvl is licensed under the **Apache License, Version 2.0**. The full text is in
[`LICENSE`](https://github.com/tuvl-io/tuvl/blob/main/LICENSE), and
[`NOTICE`](https://github.com/tuvl-io/tuvl/blob/main/NOTICE) lists the third-party material that
ships with it. This applies to the engine (`tuvl`), the UI (`tuvl-insight`), the TypeScript client
(`@tuvl/client`), the examples, the Laya server image build files, the hub and this documentation.

## What changed

| | Releases up to `2.0.0b4` (and `1.x`) | `2.0.0` and later |
|---|---|---|
| License | MIT | Apache-2.0 |
| Use, modify, distribute, sell | Yes | Yes |
| Patent license from contributors | Not stated | Express grant (§3), ending for anyone who sues over patents in the software |
| Notices | Keep the copyright notice | Keep the copyright notice and `NOTICE`; mark files you changed (§4) |
| Contributions | MIT | Apache-2.0 (§5) |
| Name and logos | Not addressed | Not licensed (§6) |

Releases published under MIT remain available under MIT: a license you received for a version does
not change. The change applies to `2.0.0` and every later release.

## What you can do

- Build commercial or private software on tuvl and ship it under your own license. Software you
  write with tuvl is yours; the license covers tuvl itself, not your workflows, models or agents.
- Modify tuvl and redistribute your changes, provided you include the license, keep the notices, and
  state that you changed the files.
- Fork it. You may not use the name "tuvl", "tuvl insight" or the feather mark to suggest that your
  fork is the official project.

This page is a summary, not legal advice; the license text governs.

## What ships with the packages

| Package | Includes |
|---|---|
| `tuvl` | `LICENSE`, `NOTICE`; metadata `License-Expression: Apache-2.0` |
| `tuvl-insight` | the same, plus `THIRD_PARTY_LICENSES.txt` (the notices of the JavaScript packages compiled into the UI) and the SIL Open Font License text for the bundled Geist fonts |
| `@tuvl/client` | `LICENSE`, `NOTICE` |

tuvl's Python dependencies are installed from PyPI under their own licenses (MIT, BSD, Apache-2.0,
ISC and, for `certifi`, MPL-2.0) and are not redistributed in these packages. A new project from
`tuvl init` carries no license: the license of your project is your choice.

The Laya decision server image redistributes Laya's code and weights, both Apache-2.0, and
PyTorch (BSD); see the `NOTICE` in `laya-serve`.

## Contributing

Contributions are accepted under Apache-2.0 (§5), without any additional terms. See
[Contributing](contributing.md).
