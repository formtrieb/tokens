# Changelog

All notable changes to `@formtrieb/tokens-render` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-07

### Changed (breaking)

- Values come from core's one resolution (`composeTheme`,
  `resolveDictionary`) and are written by one formatter per kind of
  value. The Style-Dictionary replay (transform chain, tinycolor port,
  deep-extend, sort by reference) is gone.
- The dialect is gone (`dialect`, `Dialect`). The output policy is data:
  - `units`: a unit policy `{ types?, paths? }` or a preset (`"source"`,
    `"tokens-studio"`); only lengths in px are converted, other units stay.
  - `color`: `"source"`, `"rgb"` or `"hex"`; computed colours are
    `rgb(r% g% b% / a)` under `"source"` and `"rgb"`. Applies inside
    shadows and borders too. Arithmetic CSS cannot compute is refused also
    inside nested terms.
  - `typographyCompanions`: companion variables and their token-map
    entries, default off. The `typography` builders throw without them.
- Defaults without options: lengths and colours as written, no companions.
- Variables keep source order; a reference in a composite is written at
  its own property's position; irreducible arithmetic is `calc()` from the
  resolved expression; numbers are rounded to four fraction digits.
- Every file ends with a newline, also when it carries companions.
- With references, a value that holds references inside text
  (`calc(-1 * {a})`, `{a} - 1px`) is written with `var()` in their place,
  arithmetic in `calc()`; a colour with references is written resolved.
- A zero length is written `0` under a unit target, and as written
  (`0` or `0px`) without one.
- Builders get `typographyCompanions` instead of `dialect`.
- `parseRenderFile` checks the unit policy; an older file's
  `dialect: "canonical"` is accepted without effect, `"style-dictionary"`
  is refused with the options to use instead.
- `TokenSystem` is core's type.

### Added

- `formatTokenValue(value, { path, type }, options?)`: a resolved value as
  `renderVariables` writes it, for tools that show values.
- The token map reads what each theme writes from the composed theme, so a
  token whose `$type` comes from a group is listed too.
- `TOKENS_STUDIO_UNITS`, and the types `UnitPolicy`, `UnitPreset`,
  `UnitTarget`, `ColorForm`.

### Removed

- devDependencies `tinycolor2`, `@types/tinycolor2`.

### Migrating from 0.x

| 0.x | 1.0 |
|---|---|
| `dialect: "style-dictionary"` (the default) | `units: "tokens-studio", color: "rgb", typographyCompanions: true` |
| `dialect: "canonical"` | no option needed: these are the defaults |
| `units: "rem"` | `units: "tokens-studio"`, or a policy `{ types: { dimension: "rem" } }` |
| `color: "rgb" \| "source"` | unchanged; `"hex"` is new |
| `typography` builders with the default dialect | set `typographyCompanions: true` |
| builder context `dialect` | `typographyCompanions` |
| `TokenSystem` from render | the same shape; it is core's type now |

## [0.4.0] — 2026-10-06

### Added

- `RenderFile` and `RenderFileOptions`: the format of a render file — a
  bare list of rules, or `{ options?, rules }` with the output options
  `prefix`, `dialect`, `basePxFontSize`, `units` and `color`.
- `parseRenderFile(data, source?)` reads either form and names the broken
  rule or option.

## [0.3.0] — 2026-10-06

### Changed

- `canonical` dialect: variables keep source order instead of the
  definition-before-use sort; a reference inside a composite is written in
  its own property's place instead of where its value first occurs; a
  colour a colour modifier computed stays as core wrote it, also with
  `color: "rgb"`. Same values; the order within a block changes. The
  `style-dictionary` dialect is unchanged.

## [0.2.0] — 2026-10-06

### Added

- `dialect` option: `"style-dictionary"` (default, unchanged output) or
  `"canonical"`. `canonical` writes values as core canonicalizes them —
  lengths with their own units, colour literals as written — and no
  typography companions, in the variables or the token map; a file always
  ends with a newline. The dialect sets the defaults of `units` and
  `color`, which can still be set on their own.
- Builders receive the run's `dialect` in their context. The
  `typography` and `typographyMixin` builders throw in the `canonical`
  dialect, since the companion variables they read are not written there.

## [0.1.3] — 2026-10-06

### Changed

- `basePxFontSize`, `privateTokenPrefixes` and `typography` are optional in
  `RenderOptions`, defaulting to `16`, `["*"]` and `{}`. Before, leaving one
  out crashed with a `TypeError` that did not name the option. Only `prefix`
  is required now. No output changes when all options are passed.

## [0.1.2] — 2026-10-04

### Fixed

- The CSS guard accepts `calc()` with nested parentheses. It blanked math
  functions with a regex that knew one level of nesting, so
  `calc((var(--a) - var(--b)) / 2)` was refused as leftover arithmetic.
  Math functions (`calc`, `clamp`, `min`, `max`, `round`, …) are now
  blanked by a parenthesis counter, however deep. Arithmetic outside them is
  still an error. No output changes for valid input.

## [0.1.1] — 2026-10-04

### Changed

- README rewritten for users of the package: install, an example, the
  render table, how values are written, options and errors.

## [0.1.0] — 2026-10-04

First release. Renders a Tokens-Studio-shaped token system to CSS with
`@formtrieb/tokens-core` underneath; pure functions, no file system.

### Added

- `renderVariables(system, rules, options)` — custom properties per render
  table; byte-identical to what `@formtrieb/token-resolver` wrote with
  Style Dictionary, except `calc()` for mixed-unit math on a reference.
- `deriveRenderTable(themes, config)` — the default table from
  `$themes.json`: one-theme group → `:root`, several → `[data-{group}="{name}"]`.
- `renderUtilities`, `renderImports`, `renderBundle`, `renderTokenMap`, and
  the builders `typography`, `typographyMixin`, `directional`, `single`,
  `container`.
- `InvalidCssError`: a value that is no valid CSS stops rendering, with
  token path, theme and file for every problem.
- `units: 'rem' | 'source'` and `color: 'rgb' | 'source'` options for
  producers that write lengths and colours on purpose.
