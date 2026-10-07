# formtrieb/tokens

Tooling for Tokens-Studio-shaped and DTCG design token systems. One repository
so that every consumer — CLI, MCP server, future editors — shares a single
model and a single resolution.

| Package | npm | Purpose |
|---|---|---|
| `packages/core` | `@formtrieb/tokens-core` | Model and resolution: token system, theme composition, references to typed values, colour, design rules as data. Pure functions, no I/O, browser-capable. |
| `packages/render` | `@formtrieb/tokens-render` | Token system + render table → CSS variables, utilities, `main.css`, bundle, token map. Pure functions on core, no file system. |
| `packages/mcp` | `@formtrieb/tokens-mcp` | MCP server exposing a token system to LLM clients. Shows values as render writes them. |
| `packages/cli` | `@formtrieb/tokens-cli` | CLI `formtrieb-tokens`: config, files, watch — writes what render produces. Published up to 0.7 as `@formtrieb/token-resolver`. |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

`fixtures/tokens-studio` is the synthetic token system every package tests
against. `packages/cli/tests/e2e` pins the CLI's whole output for it in a
snapshot; a change there is a change for every consumer.

## Provenance

- `packages/cli` carries the full history of the former `formtrieb/token-resolver` repository (imported via `git subtree`), published as `@formtrieb/token-resolver` up to 0.7. Up to 0.5 its CSS came from Style Dictionary.
- `packages/core` and `packages/mcp` were moved from the `cdf-workstation` monorepo at commit `c250aaf` (2026-08-23). Their published snapshots lived at `formtrieb/tokens-core` and `formtrieb/tokens-mcp`.

## Releasing

One tag publishes one package through `.github/workflows/release.yml`
(npm Trusted Publishing, with provenance):

```bash
git tag core-v2.1.0 && git push origin core-v2.1.0        # first: the others depend on it
git tag render-v1.1.0 && git push origin render-v1.1.0    # before mcp and cli, which depend on it
git tag mcp-v3.1.0 && git push origin mcp-v3.1.0
git tag cli-v1.2.0 && git push origin cli-v1.2.0
```

The tag version must equal the package's `package.json`. `pnpm pack`
replaces `workspace:^` with the released range.

## License

[Apache-2.0](./LICENSE) for the whole repository. `@formtrieb/token-resolver` (now `@formtrieb/tokens-cli`) up to 0.4.0 was published under MIT.
