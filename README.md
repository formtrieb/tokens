# formtrieb/tokens

Tooling for Tokens-Studio-shaped and DTCG design token systems. One repository
so that every consumer — CLI, MCP server, future editors — shares a single
model and a single resolution.

| Package | npm | Purpose |
|---|---|---|
| `packages/core` | `@formtrieb/tokens-core` | Model and resolution: token tree, theme axes, references, colour. Pure functions, no I/O, browser-capable. |
| `packages/mcp` | `@formtrieb/tokens-mcp` | MCP server exposing a token system to LLM clients. Depends only on core. |
| `packages/render` | `@formtrieb/tokens-render` (not yet published) | Token system + render table → CSS variables, utilities, `main.css`, bundle, token map. Pure functions on core, no file system. |
| `packages/resolver` | `@formtrieb/token-resolver` | CLI `formtrieb-tokens`: config, files, watch — writes what render produces. |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

`packages/resolver/tests/e2e` pins the whole output of the synthetic
fixture in a snapshot; a change there is a change for every consumer.

Until FOR-509 the CSS came from Style Dictionary. `render` was built next
to it and measured against it file by file (`conformance/`, removed with
the switch) until both wrote the same bytes, except two deliberate fixes:
`calc()` for mixed-unit math (FOR-496) and a refused build for values that
are no CSS (FOR-497).

## Provenance

- `packages/resolver` carries the full history of the former `formtrieb/token-resolver` repository (imported via `git subtree`).
- `packages/core` and `packages/mcp` were moved from the `cdf-workstation` monorepo at commit `c250aaf` (2026-08-23). Their published snapshots lived at `formtrieb/tokens-core` and `formtrieb/tokens-mcp`.

## Releasing

One tag publishes one package through `.github/workflows/release.yml`
(npm Trusted Publishing, with provenance):

```bash
git tag core-v1.5.0 && git push origin core-v1.5.0          # first: the others depend on it
git tag render-v0.1.0 && git push origin render-v0.1.0      # before the resolver, which depends on it
git tag mcp-v2.6.0 resolver-v0.5.0 && git push origin mcp-v2.6.0 resolver-v0.5.0
```

The tag version must equal the package's `package.json`. `pnpm pack`
replaces `workspace:^` with the released range.

## License

[Apache-2.0](./LICENSE) for the whole repository. `@formtrieb/token-resolver` up to 0.4.0 was published under MIT.
