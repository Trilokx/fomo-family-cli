# FOMO.family CLI command guide

Use `fomo --help` for CLI syntax and `fomo capabilities` for supported operations and budgets. CLI and MCP share the same implementation; MCP tool names use the `fomo_` prefix, such as `fomo_theses`.

## Your first research pass

```sh
fomo account
fomo daily --limit 3 --rows 5 --min-size-usd 10000
fomo scan --view trending --limit 3
```

`daily` combines bounded Watchlist, Trending and Most held lists, selects by overlap, and reads Friends-only holders and filtered theses. `scan` starts from one list. Both default to thesis content deduplication; `--no-since-last` rereads the current sample. Neither schedules a job or changes the watchlist.

## Find candidates and traders

```sh
fomo tokens --view watchlist --limit 20
fomo tokens --view trending --limit 10
fomo leaderboard --period 30d --limit 10
fomo alerts --min-size-usd 10000 --min-portfolio-usd 1000000 --limit 10
fomo feed --types theses,trades --limit 10
```

| Option | Available values |
| --- | --- |
| Token `--view` | `watchlist`, `crypto`, `trending`, `most-held`, `graduated`, `bonding` |
| Leaderboard `--period` | `24h`, `7d`, `30d`, `all` |
| Feed `--types` | `trades`, `closedPositions`, `theses`, `multiUserTrades`, `newListings`, `priceSpikes`, `profitMilestones`, `newTraders` |
| Alert filters | `--min-size-usd`, `--min-portfolio-usd`, `--min-market-cap-usd`, `--max-market-cap-usd` |

Feed types replace the native category selection; omitting them preserves it. Native view/filter settings can persist in Fomo.

## Investigate a coin

Replace `<chain:contract>`, `<display-name>` and `<handle>` below with values from Fomo. These are placeholders, not literal shell arguments. Use chain and contract identity rather than a ticker alone.

```sh
fomo token <chain:contract> --sections overview,holders --holders-friends-only
fomo theses <chain:contract> --min-size-usd 100000 --limit 20 --scrolls 1 --since-last
fomo position <chain:contract> --trader <display-name> --tab theses --min-size-usd 100000
fomo token <chain:contract> --sections swaps --min-size-usd 10000 --limit 10
fomo trader <handle> --period 7d --positions open --limit 10
fomo chart <chain:contract> --timeframe 1h --theses --friends-only --min-size-usd 10000
```

Token sections: `overview`, `holders`, `theses`, `swaps`. Holders support `--holders-thesis-only` and `--holders-friends-only`, both false by default. Position tabs: `theses` or `swaps`. The position reader opens the first matching trader in the bounded loaded thesis list.

Trader periods: `24h`, `7d`, `30d`; position views: `open`, `closed`. Chart timeframes: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`. Chart overlays: `--my-swaps`, `--theses`, `--friends-only`, `--min-size-usd`. Boolean flags support `--no-...`.

The native thesis minimum size is not independently verified as initial buy-in. `sinceLast` deduplicates observed text; it is not complete historical synchronization. [Research semantics](research.md).

## Organize your workspace and watchlist

```sh
fomo workspace inspect
fomo workspace split-bottom --panel 0
fomo workspace split-right --panel 0
fomo workspace close --panel 1
fomo watchlist add <chain:contract> --expected-account <handle>
fomo watchlist remove <chain:contract> --expected-account <handle>
```

Panels are zero-indexed and native layout limits apply. Closing a panel lets the remaining panels use its space. Watchlist commands verify account identity when supplied and confirm the native star state after reload. No bulk replacement is performed.

## Connect, inspect and recover

```sh
fomo login
fomo start
fomo status
fomo doctor
fomo capabilities
fomo mcp-config
fomo mcp
fomo evidence <id> --offset 0 --limit 10
fomo stop
```

`doctor` reports configuration; `account` verifies the signed-in profile. `mcp` starts the stdio server; `mcp-config` prints installation-specific connection settings. [Session setup](installation.md).

Every research response is JSON. Errors have `ok:false` and exit code 1. Inspect `partial`, `meta.outputTruncated` and row coverage. Evidence contains collected records before response trimming, not all platform history. Requests are bounded to 100 rows and five scrolls per section, with smaller workflow limits. `fomo call '{"op":"daily","limit":3}'` accepts the same strict arguments as MCP.
