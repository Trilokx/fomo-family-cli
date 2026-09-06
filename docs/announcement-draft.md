# Draft — not posted

I'm building a small Fomo CLI + MCP adapter for AI agents.

Instead of asking a model to decide every browser click, predefined workflows collect trending tokens, watchlists, holders and filtered theses into bounded JSON. The collector itself makes zero LLM calls.

One useful example: filter theses at Fomo's $100K minimum size and only return newly observed text on the next run.

It's an early private beta. Browser automation still needs maintenance, and this isn't an official Fomo API or a trading bot. I'm testing portability and unattended daily research before a wider release.
