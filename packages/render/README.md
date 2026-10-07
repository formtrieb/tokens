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
| `units` | `"source"` | unit policy or preset, see [Units](#units) |
| `basePxFontSize` | `16` | root font size for rem |
| `color` | `"source"` | `"source"`, `"rgb"` or `"hex"`, see [Colours](#colours) |
| `typographyCompanions` | `false` | companion variables for typography, see below |
| `privateTokenPrefixes` | `["*"]` | path segments starting with one of these are left out |
| `typography` | `{}` | `fontVariantNumeric.tabular`: paths that get `tabular-nums` (with companions) |

Without options every value is written as core resolved it: lengths in
their own units, colour literals as written. A Tokens-Studio export usually
wants `{ units: "tokens-studio", color: "rgb", typographyCompanions: true }`,
which is what the CLI uses by default.

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

A producer writes the table with its tree, as `render.json`: a bare list of
rules, or `{ options?, rules }` (`RenderFile`). `options` holds only output
options (`prefix`, `units`, `basePxFontSize`, `color`,
`typographyCompanions`); typography and builders are code and stay with the
caller. `parseRenderFile(data)` reads either form, checks every option
(including the unit policy: preset name, target units, path patterns) and
returns `{ options, rules }`; which side wins when the caller sets an option
too is the caller's decision. An older file's `"dialect": "canonical"` is
accepted and has no effect; `"style-dictionary"` is refused with what to
write instead.

## How values are written

- **Composition and meaning** come from core: a theme's `source` sets, then
  its `enabled` sets, in `$themes.json` order (groups merge, a token
  replaces a token whole); each value resolved and read under its type
  (`150%` line height → `1.5`, `-5%` letter-spacing → `-0.05em`, `Bold` →
  `700`, a bare `8` → `8px`, math reduced, colour modifiers computed). The
  meaning does not depend on the way to a value: `{dimension.5x}` and
  `20px` are the same length.
- Only tokens from `enabled` sets are written, in source order; path
  segments starting with a private prefix (default `*`) are left out.
  `var()` resolves at computed-value time, so no definition-before-use order
  is needed.
- **`references: true`** writes `var(--…)` where the source referenced; in
  a composite (typography, shadow, border, transition) at the position of
  the property that referenced. A computed colour keeps its computed value
  unless the modifier changed nothing. Arithmetic over a reference, like
  `{breakpoints.desktop}-1px`, is written as `calc(var(--…) - 1px)`.
- **Arithmetic** that cannot be reduced, like `80rem - 16px`, is written as
  `calc()`.
- Numbers are rounded to four fraction digits when written; core keeps
  them unrounded.
- Font families are quoted where they hold a space; typography, shadow,
  border and transition are written as shorthands; easings as
  `cubic-bezier()`.

## Units

`units` is a policy, as data: which unit a length in px is written in.
A length written in another unit (`0.5rem`, `60ch`, `50%`, `-0.05em`) is
never converted.

```ts
interface UnitPolicy {
  types?: Record<string, "rem" | "px" | "source">;
  paths?: { match: string; unit: "rem" | "px" | "source" }[];
}
```

- `paths` are checked first; the first match wins. `match` is a token's dot
  path in source casing (`zIndex.base`); `*` matches one segment, `**` zero
  or more (`breakpoints.**`).
- `types` is looked up with the token's Tokens Studio type (`spacing`),
  then with its aligned type (`dimension`), so `{ dimension: "rem" }`
  covers every length type not named itself. A type named nowhere is
  `source`.
- `rem` divides by `basePxFontSize`; under `rem` and `px` a zero length is
  written `0`.
- A shadow's lengths are looked up under the shadow's type (`boxShadow`);
  the properties of typography and border under their own types
  (`fontSizes`, `lineHeights`, `borderWidth`, …).

Two presets: `"source"` (nothing converted, the default) and
`"tokens-studio"`, exported as `TOKENS_STUDIO_UNITS`: `fontSizes`,
`spacing`, `sizing`, `borderRadius`, `paragraphSpacing`, `paragraphIndent`
and `dimension` in rem; `borderWidth` and `boxShadow` in px;
`letterSpacing` and `lineHeights` as written.

```ts
renderVariables(system, rules, {
  prefix: "ds-",
  units: { types: { dimension: "rem" }, paths: [{ match: "breakpoints.*", unit: "px" }] },
});
```

## Colours

- `"source"`: literals as written (`#336699`, `rgba(0,0,0,0.5)`,
  `lch(62 72 250)`, `CanvasText`). Tokens Studio's `rgba(#336699, 0.5)` is
  no CSS and is written as `rgba(51, 102, 153, 0.5)`.
- `"rgb"`: literals as `rgb(r, g, b)` / `rgba(r, g, b, a)`, gamut-mapped
  into sRGB.
- `"hex"`: every colour as `#rrggbb` / `#rrggbbaa`.

A colour a modifier computed has no literal. It is written as
`rgb(r% g% b% / a)` under `"source"` and `"rgb"`, as hex under `"hex"`.
Colours in shadows and borders follow the same option. A colour culori
cannot read (a gradient, a system colour) is always written as written.

## Typography companions

The `font` shorthand cannot carry letter-spacing, text-transform and the
rest. With `typographyCompanions: true` every typography token gets them as
companion properties pointing at the referenced tokens: `-letter-spacing`,
`-text-transform`, `-text-decoration`, `-text-indent`, `-margin-block-end`,
and `-fvn: tabular-nums` for paths listed in
`typography.fontVariantNumeric.tabular`; the token map lists them too. The
`typography` and `typographyMixin` builders read them and throw without
the option.

## Values that are no CSS

`renderVariables` throws `InvalidCssError` instead of writing a value that
is no valid CSS: a reference that never resolved, an object where text
belongs, a bezier without four numbers, arithmetic CSS cannot compute
(`2px * 3rem`). Every problem is listed with token path, theme and file;
nothing is written.

## Builders

`typography`, `typographyMixin`, `directional`, `single` and `container`
build utility classes. A builder gets `{ tokens, config, typographyCompanions }`:
every token of the system (sets in `$metadata.json` order, first definition
of a path wins), the caller's config and whether the variables carry
typography companions. See the
[token-resolver README](https://github.com/formtrieb/tokens/tree/main/packages/resolver#builders)
for their options.

## License

Apache-2.0
