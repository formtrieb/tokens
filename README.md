# formtrieb/tokens

Tooling for Tokens-Studio-shaped and DTCG design token systems. One repository
so that every consumer — CLI, MCP server, future editors — shares a single
model and a single resolution.

| Package | npm | Purpose |
|---|---|---|
| `packages/core` | `@formtrieb/tokens-core` | Model and resolution: token tree, theme axes, references, colour. Pure functions, no I/O, browser-capable. |
| `packages/mcp` | `@formtrieb/tokens-mcp` | MCP server exposing a token system to LLM clients. Depends only on core. |
| `packages/resolver` | `@formtrieb/token-resolver` | CLI `formtrieb-tokens`: Tokens-Studio JSON → CSS, SCSS, utilities, token map. Currently built on Style Dictionary; to be replaced by a renderer on top of core. |
| `conformance/` | — (private) | Measuring instrument: every token through core and through the resolver, divergences pinned in a baseline. See [conformance/README.md](conformance/README.md). |

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm conformance   # core vs resolver, compared with conformance/baseline.json
```

## Provenance

- `packages/resolver` carries the full history of the former `formtrieb/token-resolver` repository (imported via `git subtree`).
- `packages/core` and `packages/mcp` were moved from the `cdf-workstation` monorepo at commit `c250aaf` (2026-08-23). Their published snapshots lived at `formtrieb/tokens-core` and `formtrieb/tokens-mcp`.
