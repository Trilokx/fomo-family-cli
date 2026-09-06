# Installation and sessions

Node 22+, npm and Google Chrome are required. Run `npm ci` then `npm install --global .`. Chrome is external; no Playwright browser download is needed. Windows and macOS are targets, subject to the verification matrix.

`fomo login` opens normal Chrome with a dedicated profile. Sign in yourself, close that window, then `fomo start`. Google may reject automated-browser sign-in: use this manual login workflow, never evasion flags. Do not copy cookies between computers. Do not operate the same browser window manually while a collection runs.

State defaults to `%LOCALAPPDATA%/trlx-fomo` on Windows and `~/.local/state/trlx-fomo` on macOS. Override with an absolute `FOMO_STATE_DIR`; use the same value in every CLI/MCP/scheduled call. Keep state outside the checkout.

`FOMO_BROWSER_CHANNEL` defaults to chrome. `FOMO_CHROME_PATH` changes the normal-login executable. Other channels are unverified. `FOMO_HEADLESS=1` is experimental; testing produced an incomplete shell. Mac scheduling requires an available desktop session. A sleeping or logged-out Mac is not a verified environment.

`fomo mcp-config` emits the correct absolute paths for the installation. Copy its server entry into your host's MCP settings. The plugin's PATH-based config instead needs globally installed fomo available to the host. Restart the AI host after changes.

After upgrading: `fomo stop`, `npm ci`, then `fomo start`. `status` reports runtime state; `account` verifies identity. `doctor` reports configuration, not successful login. Login errors must never become empty market data.

The daemon binds to loopback, rejects browser Origin requests, verifies a random local bearer token, and serializes calls. This is internal transport, not a Fomo HTTP API. Unix state files have restrictive permissions; Windows protection depends on directory ACLs. Never expose the port remotely. Session expiry needs manual login. Evidence/chart files currently have no automatic retention.
