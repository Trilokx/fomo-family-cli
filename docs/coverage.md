# Coverage and release assessment

Verified against the live Windows Fomo UI on September 6, 2026. These are bounded snapshots on one authenticated account, not exhaustive coverage or availability guarantees.

| Capability | Evidence | Limits |
| --- | --- | --- |
| Account | Signed-in profile identified | No following-list export |
| Tokens | All 6 views returned data | Loaded rows only |
| Leaderboard | 24h, 7d, 30d, all returned traders | Displayed PnL, not audited |
| Alerts | Native size/portfolio/market-cap settings read and changed | Notification settings and trader-selection editor not exposed |
| Feed | Eight category switches verified; thesis-only and all-category reads | Pinned preview may be truncated |
| Holders | Thesis-only and Friends-only controls; followed holder rows | Fomo UI holders, not full on-chain distribution |
| Theses | $0/$1K/$5K/$10K/$100K custom values; 80 collected rows with 4 scrolls; repeat dedupe | Not all 1,600; native size is not independently verified initial purchase |
| Position detail | Selected trader's displayed Thesis and Swaps dialogs | Bounded loaded position/history |
| Trader | 7d open and 30d closed returned distinct position rows | Loading/empty edge cases require wider testing |
| Chart | All 6 exposed timeframes; overlay toggles and custom minimum size | No drawings/indicator editing or OHLCV export |
| Layout | Bottom split, right column, close/recombine | Subject to native column/row limits; no drag-resizing |
| Watchlist | Idempotent add; add/remove round trip; state after reload | Explicit per-token command, no bulk replacement |
| Daily | Two candidates, three rows, no per-candidate errors | Heuristic selection; bounded sources; not a complete daily event capture |
| MCP | Real stdio client initialized, listed 17 tools, called capabilities | Each named AI host is not separately certified |
| Automated checks | 18 tests passed; TypeScript build/check; npm audit no vulnerabilities | No configured ESLint; no browser fixture regression suite yet |

## Release decision

Suitable for a **private evaluation beta**. Not yet defensibly 95/100 for public, unattended distribution. Assigning that score from a successful demo would conceal missing evidence.

Public release gates: logged-in smoke on a second machine; several scheduled runs including session expiry/failure behavior; browser regression fixtures; complete contract-vs-live matrix including empty states; documented state retention; chosen distribution license and support expectations; installation tests in target AI hosts.

GitHub CI completed successfully on Windows, macOS and Linux for commit 09084dde92656979bc9af0dafe9cb020040cd31c: clean dependency installation, build, typecheck, 18 tests and production dependency audit. A separate Mac Mini installation also passed build/check and all 18 tests using Node 25.9.0. Its dedicated manual Chrome login is still awaiting the account owner; no authenticated Mac daily run or active schedule is claimed. In the managed installer session, Git metadata writes were blocked; the exact commit's files were installed from an authenticated temporary clone instead. Standard terminal clone installation is documented, but that sandbox constraint remains a deployment consideration.

This package covers the requested core research workflows. It does not claim every Fomo screen control: notification/audio settings, follow management, search UI, chart indicators/drawings and account/trade controls are not exposed. Trading, transfers and posting are outside this beta's scope. X enrichment is deferred.
