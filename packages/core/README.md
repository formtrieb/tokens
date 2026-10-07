# @formtrieb/tokens-core

**Core library for Tokens-Studio-shaped design token systems: build a
system from its files, compose a theme, resolve every reference to a typed
value, and the colour functions and checks around it. Pure functions, no
I/O.**

[`@formtrieb/tokens-render`](https://github.com/formtrieb/tokens/tree/main/packages/render)
writes CSS from this resolution, [`@formtrieb/tokens-mcp`](https://github.com/formtrieb/tokens/tree/main/packages/mcp)
shows it to LLM clients. Reading files is the caller's job: core takes the
parsed JSON.

License: Apache-2.0. Requires Node ≥ 20. ESM only.

## Install

```bash
npm install @formtrieb/tokens-core
```

## What's inside

| Surface | Symbols | Purpose |
|---|---|---|
| **System** | `namedSets`, `buildTokenSystem` | Which files a token system has (`$metadata.json`, `$themes.json`, and the sets these two name — nothing else), and the system from those files. A named set without a file is reported. |
| **Composition** | `compose`, `composeTheme`, `themeSelection` | The tokens a selection of sets yields: `source` sets, then `enabled` sets; groups merge, a token replaces a token whole, a group's `$type` reaches the tokens below it. |
| **Resolution** | `resolveDictionary`, `resolveToken`, `referencesIn`, `textOf`, `alignType` | Every reference resolved (`{a.b}`, `{a.b.$value}`, in text, arrays, composites and colour modifiers), every value read under its Tokens Studio type into a `TokenValue` (`length`, `number`, `color`, `fontWeight`, `typography`, `shadow`, …), unrounded, with the chain of visited tokens and the problems found (unknown reference, cycle, invalid value, …). |
| **Colour** | `parseColor`, `cssColor`, `modifyColor`, `oklchToHex`, `hexToOklch`, `contrastWcag`, `deltaE2000`, `deltaEOK`, `over`, `withAlpha`, `alphaOf`, `isInSrgbGamut`, `findColorMatches` | Read a colour (also Tokens Studio's `rgba(<colour>, a)`), write it in one of four CSS forms, apply a Tokens Studio modifier, convert, measure contrast and distance, layer colours, find tokens by colour. Gamut mapping into sRGB by the CSS Color 4 method. |
| **Themes** | `parseThemes`, `buildAxisMap`, `getThemeByName`, `getDefaultAxes`, `describeAxes`, `validateAxes` | `$themes.json` read, themes grouped into axes, defaults, and a check of an axis selection that names what exists. |
| **Analysis** | `findPlaceholders`, `findBrokenReferences`, `compareStructure` | Placeholder colours (`#f305b7`), references to nothing, structural differences between two sets of tokens. Each takes dictionary entries. |
| **Report** | `designReport` | One report of the checks — rules grouped by rule, references to nothing, parity of the themes of an axis, resolution problems with their severity — in the form the MCP server and the CLI show. |
| **Design rules** | `parseRules`, `checkRules`, `matchPath` | Rules as data: which references a token may hold, which segments a path may use, how deep it may go, no sibling references. Patterns are dot paths or set names with `*` (one segment) and `**` (any). The rules come from the design system, not from this package. |

See [`src/index.ts`](src/index.ts) for every export and type.

## Minimal example

```typescript
import { readFileSync } from "node:fs";
import { buildTokenSystem, namedSets, composeTheme, resolveDictionary, cssColor } from "@formtrieb/tokens-core";

// Read the files a token system has
const read = (name: string) => JSON.parse(readFileSync(`./tokens/${name}`, "utf8"));
const files = new Map<string, unknown>([["$metadata.json", read("$metadata.json")], ["$themes.json", read("$themes.json")]]);
for (const set of namedSets(files.get("$metadata.json"), files.get("$themes.json"))) files.set(`${set}.json`, read(`${set}.json`));

// Build, compose a theme, resolve
const { system, problems } = buildTokenSystem(files);
const { values } = resolveDictionary(composeTheme(system, "Theme/Light"));
const background = values.get("color.background")!;
console.log(background.value);  // → { kind: "color", literal: "#f5f5f5", color: { … } }
console.log(background.chain);  // → every token visited, with its set
if (background.value.kind === "color" && background.value.color) console.log(cssColor(background.value.color, "hex"));
```

## Relationship to other packages

| Package | Role |
|---|---|
| [`@formtrieb/tokens-mcp`](https://github.com/formtrieb/tokens/tree/main/packages/mcp) | MCP server exposing this library to LLM clients (Claude Desktop, MCP Inspector, custom runtimes). Thin adapter — every parsing/resolution decision lives here. |

## Development

```bash
pnpm install
pnpm --filter @formtrieb/tokens-core build
pnpm --filter @formtrieb/tokens-core test
```

## License

[Apache-2.0](./LICENSE)
