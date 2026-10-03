# @formtrieb/tokens-core

**Core library for Tokens-Studio-shaped design token systems — loaders,
theme composition, reference resolution, and DTCG-aware analysis primitives.
Pure functions, framework-agnostic.**

This package is the substrate that [`@formtrieb/tokens-mcp`](https://github.com/formtrieb/tokens-mcp) wraps for LLM
clients. It has no I/O of its own beyond optional file-reading helpers, no MCP
layer, no opinionated-DS assumptions — just typed functions for parsing
`$themes.json` + token sets, resolving `{token.references}` through theme
composition, and walking DTCG-style trees.

## Status

**v1.0.0 — initial public release.** Extracted from `formtrieb-tokens-core@1.0.0`
(private; identical surface). The library has shipped under `workspace:*`
inside the Formtrieb monorepo for ~6 weeks; this version strips the
monorepo-internal coupling and re-publishes as a standalone npm package.

License: Apache-2.0. Requires Node ≥ 20.

## Install

```bash
npm install @formtrieb/tokens-core
# or pnpm
pnpm add @formtrieb/tokens-core
```

## What's inside

| Surface | Symbols | Purpose |
|---|---|---|
| **Token tree** | `TokenTree` | DTCG-aware walker over Tokens-Studio set files. `flattenSet`, `buildMergedTree`, `countTokensInSet`. |
| **Reference resolution** | `ReferenceResolver` | Resolves `{color.controls.brand.background.enabled}` chains across enabled+source sets, returning the full step path for traceability. |
| **Theme composition** | `parseThemes`, `buildAxisMap`, `getActiveSets`, `getDefaultAxes`, `getAxisGroups`, `getThemesForGroup`, `getThemeByName` | Read `$themes.json`, group themes by axis, compute which token sets are enabled vs. source for a given axis selection. |
| **Color resolution** | `resolveLchToHex`, `applyColorModifier`, `isLchFormula`, `isPlainColor`, `isInSrgbGamut`, `resolveLchToHexWithGamut` | LCH ↔ sRGB-hex conversion via [culori](https://culorijs.org/), plus DTCG `$extensions.studio.tokens.modify` color-modifier application. |
| **Math evaluation** | `evaluateMath`, `containsMath` | Resolves arithmetic in token values (`{spacing.base} * 2`). |
| **Validation primitives** | `findPlaceholders`, `findBrokenReferences`, `compareStructure` | Detect magenta placeholders (`#f305b7`/`#ff00ff`), unresolved `{ref}` chains, and structural diffs between two sets (e.g. Light vs. Dark parity). |
| **Design rules** | `checkControlsInteractionMapping`, `checkComponentReferences`, `checkNamingConventions` | Formtrieb-flavoured rule checks for controls/status hierarchies. Optional — opt-in per use case. |
| **Types** | `RawToken`, `TokenExtensions`, `ColorModifier`, `ResolutionStep`, `ResolutionChain`, `ThemeDefinition`, `ThemeAxes`, `TokenSetInfo`, `DesignRuleViolation`, `PlaceholderToken`, `StructuralDiff` | Full TypeScript types for everything above. |

See [`src/index.ts`](src/index.ts) for the full export list.

## Minimal example

```typescript
import { readFileSync } from "node:fs";
import { TokenTree, parseThemes, getActiveSets, ReferenceResolver } from "@formtrieb/tokens-core";

// Load a Tokens-Studio workspace
const setOrder = JSON.parse(readFileSync("./tokens/$metadata.json", "utf8")).tokenSetOrder;
const sets = new Map(
  setOrder.map((name: string) => [name, JSON.parse(readFileSync(`./tokens/${name}.json`, "utf8"))])
);
const themes = parseThemes(JSON.parse(readFileSync("./tokens/$themes.json", "utf8")));

// Compose a theme + resolve a token
const tree = new TokenTree(sets, setOrder);
const { enabled, source } = getActiveSets(themes, { Theme: "Light" });
const merged = tree.buildMergedTree(enabled, source);

const resolver = new ReferenceResolver(merged);
const chain = resolver.resolve("color.background");
console.log(chain.finalValue);  // → resolved hex
console.log(chain.steps);       // → full reference path for traceability
```

## Relationship to other packages

| Package | Role |
|---|---|
| [`@formtrieb/tokens-mcp`](https://github.com/formtrieb/tokens-mcp) | MCP server exposing this library to LLM clients (Claude Desktop, MCP Inspector, custom runtimes). Thin adapter — every parsing/resolution decision lives here. |
| [`@formtrieb/cdf-core`](https://github.com/formtrieb/cdf-core) + [`@formtrieb/cdf-mcp`](https://github.com/formtrieb/cdf-mcp) | Component Description Format. Independent of this package. CDF inlines its own generic `TokenTree` (forked from this library 2026-04-26) so it has no runtime dep on `tokens-core`. |

## Development

```bash
pnpm install
pnpm --filter @formtrieb/tokens-core build
pnpm --filter @formtrieb/tokens-core test
```

## License

[Apache-2.0](./LICENSE)
