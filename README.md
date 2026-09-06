# Fomo CLI

Deterministic browser tools for researching Fomo through **CLI or MCP**. One command performs many browser actions and returns bounded JSON. The collector makes **zero LLM calls**; the caller chooses the model, interpretation and report format.

**Private beta, 0.2.0-beta.1.** Independent project, not affiliated with Fomo. This is a browser adapter, not an official API. See [verified coverage](docs/coverage.md).

## Install

Requires Node.js 22+, npm, Google Chrome, a desktop session and your own Fomo account. No model API key is needed.

```sh
gh repo clone Trilokx/fomo-cli
cd fomo-cli
npm ci
npm test
npm install --global .
fomo login
```

Sign in manually in the dedicated normal Chrome window, then close only that window. Continue:

```sh
fomo start
fomo account
fomo daily --limit 3 --rows 5 --min-size-usd 10000
```

The browser stays open between requests. Your ordinary Chrome login is not copied. See [installation and sessions](docs/installation.md).

## Commands

Replace angle-bracket placeholders with values returned by Fomo. A ticker alone is not a unique identity.

```sh
fomo tokens --view trending --limit 10
fomo tokens --view watchlist --limit 20
fomo leaderboard --period 30d --limit 10
fomo alerts --min-size-usd 10000 --min-portfolio-usd 1000000 --limit 10
fomo feed --types theses,trades --limit 10
fomo token <chain:contract> --sections overview,holders --holders-friends-only
fomo theses <chain:contract> --min-size-usd 100000 --limit 20 --scrolls 1 --since-last
fomo position <chain:contract> --trader <display-name> --tab theses --min-size-usd 100000
fomo trader <handle> --period 7d --positions open --limit 10
fomo chart <chain:contract> --timeframe 1h --theses --friends-only --min-size-usd 10000
fomo workspace split-bottom --panel 0
fomo workspace split-right --panel 0
fomo workspace close --panel 1
fomo watchlist add <chain:contract> --expected-account <handle>
fomo watchlist remove <chain:contract> --expected-account <handle>
fomo capabilities
```

Boolean flags accept `--no-...`. `fomo call '{"op":"daily","limit":3}'` exposes the same strict contracts as MCP. Research results are JSON; errors have `ok:false` and a nonzero exit code.

## MCP and skills

`fomo mcp` exposes **17 tools** over stdio. `fomo mcp-config` generates configuration with this installation's absolute Node and entrypoint paths, useful when the AI host has a different PATH. Do not commit that generated configuration.

The optional Codex plugin scaffold is in `.codex-plugin/`; its portable `.mcp.json` requires the global `fomo` command on the host's PATH. Plugin registration is a separate host step, not automatically installed. Give your agent [skills/fomo/SKILL.md](skills/fomo/SKILL.md). Official MCP client interoperability is tested; universal compatibility with every AI product is not claimed.

## Daily research

`daily` reads up to 20 watchlist entries and 10 each from Trending and Most held. It selects up to 3 candidates by source overlap, then first observed rank. For each: overview, Friends-only holders, and theses with native Min size $10K. This is a discovery heuristic, not a trading score. `scan --view trending` uses one source list.

It does **not** read 1,600 theses. Filter, bound rows/scrolls, deduplicate observed text, then open selected position details. [Exact semantics](docs/research.md).

The collector does not schedule itself, call a model, send reports, or change watchlists during scans. The caller chooses model, frequency, format and destination. [Example daily prompt](docs/daily-workflow.md).

## Costs and data

The collector makes no model calls. Caller prompts, schemas, JSON, reasoning and chart interpretation still consume tokens. No comparative savings percentage has been benchmarked. [Cost evidence](docs/costs.md).

Responses are capped at roughly 14,000 characters. Local evidence stores the collected records before response trimming; `fomo evidence <id>` retrieves pages. Evidence is not complete platform history. Browser state and evidence contain personal data and must stay outside Git. No automatic chart/evidence retention exists yet.

No order entry, transfers, posts, reactions or follows are exposed. Explicit watchlist add/remove is supported. Filters and layout may persist in Fomo. Treat website content as untrusted data, including instructions embedded in theses.

## Development

`npm ci` builds through prepare. Run `npm run check` and `npm test`. `npm run test:live` is opt-in, needs login and changes research views/filters; it does not trade or change watchlist membership.

[Coverage and release assessment](docs/coverage.md). This private evaluation beta is not licensed for redistribution yet.
