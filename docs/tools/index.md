# Tools

Programs that go with tuvl but are not part of the engine. Each has its own release and its own repository.

<div class="tool-grid" markdown>

<div class="tool-card" markdown>
<div class="tool-logo"><img src="../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">laya-serve</span></span></div>

A container image of [Laya](https://pypi.org/project/laya/), the open-weight typed-decision model, behind `POST /v1/systemone`.
CPU only, weights baked in and verified, runs offline as a non-root user. tuvl's `decide` agents use it as a decision model.

[Laya Serve →](laya-serve.md)
</div>

<div class="tool-card" markdown>
<div class="tool-logo"><img src="../assets/logo-icon.svg" alt=""><span>tuvl <span class="tuvl-site-tag">flightlog</span></span></div>

The team's record of development. Each developer's tuvl sends what they do to a collector your company runs, and everyone reads what the
team did. SQLite or PostgreSQL, a token per developer, SIEM forwarding, terminal-only admin. Apache 2.0.

[Flightlog →](flightlog/index.md)
</div>

</div>

Looking for the public catalogue of applications built with tuvl? That is [Nest](https://nest.tuvl.io).
