# @formtrieb/tokens-mcp

**MCP server exposing Tokens-Studio-shaped design token systems to LLM
clients — browse, resolve, theme compose/compare, validation. Per-call
`tokens_path` with walk-up auto-detection and mtime-aware LRU cache for
live brand iteration.**

This package is a thin MCP adapter over [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core).
The 10 tools below let an LLM client (Claude Desktop, MCP Inspector,
custom runtimes) inspect a Tokens-Studio workspace, resolve token
references through theme composition, compare themes, and audit the
system for placeholders or broken references.

## Status

**v2.0.0 — initial public release.** Hard-break vs. private
`formtrieb-tokens-mcp@1.0.0`. Three structural changes power the new
surface:

1. **Per-call `tokens_path`** — every tool accepts an optional
   `tokens_path` parameter; walk-up from `process.cwd()` resolves it
   when omitted.
2. **Stateless tools** — no global `set_tokens_path` initialization;
   each call resolves its context independently. One MCP process can
   serve multiple token directories.
3. **mtime-aware LRU cache** — the same path stays cached across calls
   (capacity 8); any `.json` file mtime change in the tree evicts and
   reloads. Edits flow through to the next tool call without restart.

License: Apache-2.0. Requires Node ≥ 20.

## Install + configure

The recommended path is per-project `.mcp.json` via `npx`:

```json
{
  "mcpServers": {
    "formtrieb-tokens": {
      "command": "npx",
      "args": ["-y", "@formtrieb/tokens-mcp"]
    }
  }
}
```

That's it. The walk-up resolver finds `tokens/` automatically when you
work in any subdirectory of a project that contains a Tokens-Studio
workspace (i.e. a `tokens/` directory with `$metadata.json` at its root).

### Path resolution order

Every tool resolves `tokens_path` in two steps, first match wins:

1. **Explicit argument** — `{ tokens_path: "/abs/path/to/tokens" }`.
   Always wins. Use when working with multiple DSes in one session.
2. **Walk-up from cwd** — climbs from `process.cwd()` looking for
   `tokens/$metadata.json`. First match wins (closest to cwd).
If neither finds a folder, the tool throws an `Error` naming both. The
`TOKENS_PATH` environment variable of 1.x and 2.x is no longer read.

### Standalone install

For non-MCP usage (testing, scripting):

```bash
npm install -g @formtrieb/tokens-mcp
tokens-mcp  # launches the stdio server
```

## Tools

| Tool | Purpose |
|------|---------|
| `list_token_sets` | List all sets in order with layer + token count. Read-only overview. |
| `list_themes` | List all themes grouped by axis, plus the default value per axis. Axis names come from the loaded `$themes.json` and differ per design system — call this to discover valid `theme:` values. |
| `browse_tokens` | Browse tokens as a nested tree, filterable by set or layer, path-prefix, `$type`. Configurable depth. |
| `search_tokens` | Case-insensitive substring search across token dot-paths. Up to 100 results. |
| `resolve_token` | Resolve a single dot-path for a given theme: `finalValue` as `@formtrieb/tokens-render` writes it, the typed `value`, the token's `type`, the full reference chain and any `problems`. |
| `resolve_batch` | Resolve multiple dot-paths in one call. Useful for a variant's full state matrix. |
| `compose_theme` | Show which token sets are active (enabled vs. source) for a given axis selection; missing axes take their default and are listed in `defaulted`. |
| `compare_themes` | Diff values (as render writes them) between two theme configurations; missing axes take their default. Caps: 200 changed paths, 50 per only-in-A/B list. |
| `find_placeholders` | List all `#f305b7` placeholder tokens. Audit token completeness. |
| `check_design_rules` | Run controls/component-reference + naming + broken-reference + Light/Dark parity checks. Reports violations grouped by rule. |

Every tool accepts an optional `tokens_path: string` parameter (omit for walk-up).

Theme axes are read from the loaded `$themes.json` — the groups it assigns to its
themes are the axes, the theme names are the values. `{ Semantic: "Light" }` and
`{ Brand: "Globex", Density: "Compact" }` are equally valid; what counts is what the
token system defines. Omitted axes fall back to their default (the first theme in the
group), and an axis or value the system does not define is rejected with a list of the
ones that exist. Themes with no `group` collect under the `Ungrouped` axis.

The unit of this server is the **axis selection**: one theme per axis, the sets of all
chosen themes read together (a set is enabled when a chosen theme enables it, else
source; enabled sets win). The unit of `@formtrieb/tokens-render` is the **single
theme**, written as its own block. Both use the same resolution in
`@formtrieb/tokens-core` and the same formatter, so a value is the same wherever the
sets agree; where a theme names two alternatives as source (say a component theme
sourcing both Light and Dark), the server follows the chosen axis and render the
theme's own order.

Token types are those of the loaded system: the `type` filter of `browse_tokens`,
`search_tokens` and `compare_themes` accepts any `$type` the system uses (also one
inherited from a group) and rejects others with the list of types in use.

`finalValue` shows lengths as written and colours by `format`: `source` (default,
literals as written), `rgb` or `hex`; a colour a modifier computed is
`rgb(r% g% b% / a)` unless `hex`. The typed `value` carries the full precision, the
literal as written and, for colours, `outOfGamut`.

## Brand-iteration loop

The single biggest UX win in 2.0.0 is the live edit loop. With v1.0.0
you had to restart the MCP server every time you touched a token file.
With 2.0.0:

1. Ask Claude to resolve a brand token: *"What's `color.controls.brand.background.enabled` in Light mode?"*
2. Claude calls `resolve_token` → returns current value via cache.
3. Edit your token JSON file (via the Tokens Studio Figma plugin or any
   editor).
4. Ask Claude to resolve again. The mtime-walk on the next call detects
   the change, evicts the cache, reloads the tree. New value returned.

No restart. No path argument needed. Cost of the per-call mtime walk is
~5–15 ms on typical DS sizes (verified via [perf-smoke test](./test/token-context.test.ts)).

## Migrating from v1.0.0

| Before (v1.0.0) | After (v2.0.0) |
|---|---|
| `TOKENS_PATH=/abs/path` env var, loaded once at startup | Walk-up auto-detect from cwd; or pass `tokens_path` per call. The env var is no longer read since 3.0. |
| Server restart needed after token-file edits | mtime-aware cache reloads on next call. |
| One MCP process = one DS | One process can serve any number of DSes (LRU cap 8). |
| Package: `formtrieb-tokens-mcp` (private) | Package: `@formtrieb/tokens-mcp` (public, npm). |

If you have an existing `.mcp.json` that points at this package, dropping
the `env` block is the only required change:

```diff
 {
   "mcpServers": {
     "tokens": {
       "command": "npx",
-      "args": ["tsx", "packages/tokens-mcp/src/index.ts"],
-      "env": {
-        "TOKENS_PATH": "./tokens"
-      }
+      "args": ["-y", "@formtrieb/tokens-mcp"]
     }
   }
 }
```

## Relationship to other packages

| Package | Role |
|---|---|
| [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core) | Pure-function library for parsing + resolving + composing Tokens-Studio workspaces. This MCP server is a thin wrapper. |
| [`@formtrieb/cdf-mcp`](https://github.com/formtrieb/cdf-mcp) | Component Description Format MCP. Independent product. Use both side-by-side in a single Claude session if you author components against tokens. |

## Format support

Tokens Studio JSON workspaces with `$metadata.json` + `$themes.json` +
per-set `*.json` files. A token is an object with `$value`; its `$type` is
its own or its group's. DTCG `{ value, unit }` dimensions are read.
DTCG-flat (a single `tokens.json`) is not supported.

## Development

```bash
pnpm install
pnpm --filter @formtrieb/tokens-mcp build
pnpm --filter @formtrieb/tokens-mcp test
```

## License

[Apache-2.0](./LICENSE)
