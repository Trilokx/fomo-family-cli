# Help improve FOMO.family CLI

Useful feedback starts with a research workflow: what you wanted to learn, the command you ran, and where the result differed from what Fomo displayed.

## Report a broken flow

[Open an issue](https://github.com/Trilokx/fomo-family-cli/issues/new/choose) with the package version, OS, Node/Chrome version, command and redacted error. Include whether login succeeded and whether the problem repeats once. Describe expected and observed behavior.

Do not upload browser profiles, cookies, runtime authentication tokens, generated MCP paths, private account evidence or unredacted screenshots. A security concern should be reported without exploit details or credentials in a public issue; contact the repository owner through a channel you already trust.

## Work on the code

```sh
npm ci
npm run check
npm test
```

Keep changes focused. CLI and MCP use the same contracts and adapter. Preserve explicit limits, nulls for unknown values and errors for unverified state. Add regression coverage for meaningful parser or contract changes. Never turn research commands into trading or posting actions.

`npm run test:live` is opt-in and requires your own logged-in Fomo browser. It changes research views and filters. Keep its evidence outside Git. Document what was actually verified, including incomplete and failed cases.

For product copy and repository presentation, follow the [TRLX README format](docs/product-readme-template.md). Contributions to this project are provided under the [MIT License](LICENSE).
