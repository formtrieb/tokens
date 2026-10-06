# @formtrieb/tokens-render

**Renders a Tokens-Studio-shaped token system to CSS: variables per render
table, utility classes, `main.css`, bundle, token map. Pure functions over
the [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core)
tree. No file system, no console.**

The CLI [`@formtrieb/token-resolver`](https://github.com/formtrieb/tokens/tree/main/packages/resolver)
loads a config, calls these functions and writes the files. Use this package
directly when you want the CSS in memory — in a build tool, a generator, a
test.

## Install

```bash
npm install @formtrieb/tokens-render @formtrieb/tokens-core
```

ESM only, Node ≥ 20.

## Functions

| Function | Returns |
|---|---|
| `deriveRenderTable(themes, config)` | `RenderRule[]` — the default table from `$themes.json` |
| `parseRenderFile(data, source?)` | `{ options, rules }` — a render file read and checked |
| `renderVariables(system, rules, options)` | `variables/*.css` |
| `renderUtilities(system, builders, options, config?)` | `utilities/*` |
| `renderImports(files, existing?)` | `main.css` |
| `renderBundle(files)` | `bundle.css` |
| `renderTokenMap(system, options)` | `token-map.json` |

Every render function returns a `Map` of output file (relative to the CSS
output root) to content. Writing it is the caller's job.

```ts
import { parseThemes } from "@formtrieb/tokens-core";
import { deriveRenderTable, renderVariables } from "@formtrieb/tokens-render";

const system = {
  order: ["base", "dark"],                       // set order, as in $metadata.json
  sets: new Map([["base", baseJson], ["dark", darkJson]]),
  themes: parseThemes(themesJson),               // $themes.json
};
const rules = deriveRenderTable(system.themes);
const files = renderVariables(system, rules, { prefix: "ds-" });
// files.get("variables/mode.css") → "[data-mode=\"Dark\"] { … }"
```

Only `prefix` is required. The other options and their defaults:

| Option | Default | |
|---|---|---|
| `dialect` | `"style-dictionary"` | `"canonical"` for producers that write on purpose, see below |
| `basePxFontSize` | `16` | root font size for rem |
| `units` | `"rem"` (`"source"` in `canonical`) | `"source"` keeps lengths as written, see below |
| `color` | `"rgb"` (`"source"` in `canonical`) | `"source"` keeps colour literals as written, see below |
| `privateTokenPrefixes` | `["*"]` | path segments starting with one of these are left out |
| `typography` | `{}` | `fontVariantNumeric.tabular`: paths that get `tabular-nums` (`style-dictionary` only) |

## The render table

One rule says which theme is written where, under which selector:

```ts
interface RenderRule {
  theme: string;       // `{group}/{name}` from $themes.json
  selector: string;    // ':root', '[data-mode="Dark"]', …
  media?: string;      // wraps the block in @media
  references: boolean; // var(--…) for references, or resolved values
  file: string;        // 'variables/mode.css'
}
```

The unit is the theme, not the set. The selector is the app's decision how
it switches themes, so the table belongs to the consumer.
`deriveRenderTable(themes, config)` gives the default: a group with one
theme goes to `:root`, a group with several to `[data-{group}="{name}"]`,
one file per group, references per group from `themeGroups` /
`defaultGroupBehavior`. Rules that write to the same file become blocks of
that file, in table order.

Which set overrides which comes from the theme in `$themes.json`, never from
code: render knows no set, group or theme name.

### Render file

A producer that writes a tree for one dialect writes the table with it, as
`render.json`: a bare list of rules, or `{ options?, rules }`
(`RenderFile`). `options` holds only output options (`prefix`, `dialect`,
`basePxFontSize`, `units`, `color`); typography and builders are code and
stay with the caller. `parseRenderFile(data)` reads either form and
returns `{ options, rules }`; which side wins when the caller sets an
option too is the caller's decision.

## How values are written

- **Composition.** A theme's `source` sets, then its `enabled` sets, in
  `$themes.json` order, deep-merged: a later set wins. Only tokens from
  `enabled` sets are written; path segments starting with a private prefix
  (default `*`) are left out.
- **Meaning** comes from core's `canonicalize`: `150%` line height → `1.5`,
  `-5%` letter-spacing → `-0.05em`, `Bold` → `700`, a bare `8` → `8px`,
  math reduced. Colour modifiers (`$extensions['studio.tokens'].modify`) are
  computed by core.
- **Presentation** by default: lengths in rem (`basePxFontSize`), colour
  literals as `rgb(r, g, b)` / `rgba(…)`, computed colours as
  `rgb(r% g% b% / a)`, quoted font families, `font` / shadow / border
  shorthands, `cubic-bezier()`.
- **Literal or reference.** A token that references another takes the
  target's finished value. A line height pointing at a dimension therefore
  ships in rem, a literal line height in px.
- **`references: true`** writes `var(--…)` where the source referenced, in
  an order where every variable is defined before it is used. A computed
  colour keeps its computed value.
- **Arithmetic** that cannot be reduced, like `{breakpoints.desktop}-1px`,
  is written as `calc(var(--…) - 1px)`.
- **Typography tokens** get companion properties next to the `font`
  shorthand, which cannot carry them: `-letter-spacing`, `-text-transform`,
  `-text-decoration`, `-text-indent`, `-margin-block-end`, and
  `-fvn: tabular-nums` for paths listed in
  `typography.fontVariantNumeric.tabular`.

The output is byte-compatible with `@formtrieb/token-resolver` up to 0.5,
which used Style Dictionary, apart from the `calc()` form above and the
refused values below.

## Dialects

Both dialects read the same tree and write the same variable names, render
table, files and blocks. They differ in values, companions and the order
within a block.

- **`style-dictionary`** (default) writes what the Style-Dictionary pipeline
  wrote, as described above: rem, `rgb()`, typography companions. It does
  not change, so existing systems keep their exact CSS.
- **`canonical`** writes each value as core canonicalizes it — lengths
  with their own units, colour literals as written — and no typography
  companions, in the variables or in the token map. It is meant for
  producers that write their tokens on purpose and carry letter-spacing,
  text case and the like as tokens of their own. It also leaves three habits
  the Style-Dictionary output had:
  - Variables keep source order. `var()` resolves at computed-value time, so
    no definition-before-use sort is needed; the old sort compared
    non-transitively and its order followed the engine's sort algorithm.
  - A reference inside a composite (typography, shadow, border, transition)
    is written in its own property's place. Replaced by value, a line height
    equal to the font size took the font size's place.
  - A colour a modifier computed stays as core wrote it, also with
    `color: "rgb"`. The literal colour step read core's
    `rgb(r% g% b% / a)` as opaque.

```ts
renderVariables(system, rules, { prefix: "ds-", dialect: "canonical" });
```

The dialect only sets the defaults of `units` and `color`; either can
still be set on its own. Pass the same options to `renderVariables`,
`renderUtilities` and `renderTokenMap`. The `typography` and
`typographyMixin` builders read the companions and throw in the
`canonical` dialect.

## Units and colours as written

`units` and `color` switch single parts of the presentation:

- `units: "source"` keeps lengths as the canonical value has them: `1024px`,
  `-0.05em`, `60ch`; a bare number is px.
- `color: "source"` keeps colour literals as written: `#336699`,
  `rgba(0,0,0,0.5)`, system colours like `CanvasText`. Computed colours
  still come from core as `rgb(r% g% b% / a)`.

## Values that are no CSS

`renderVariables` throws `InvalidCssError` instead of writing a value that
is no valid CSS: an object where text belongs (`cubic-bezier([object
Object], …)`), a reference that never resolved, a bezier without four
numbers, arithmetic that is neither reduced nor in `calc()`. Every problem
is listed with token path, theme and file; nothing is written.

## Builders

`typography`, `typographyMixin`, `directional`, `single` and `container`
build utility classes. A builder gets `{ tokens, config, dialect }`: every
token of the system (sets in `$metadata.json` order, first definition of a
path wins), the caller's config and the dialect of the run. See the
[token-resolver README](https://github.com/formtrieb/tokens/tree/main/packages/resolver#builders)
for their options.

## License

Apache-2.0
