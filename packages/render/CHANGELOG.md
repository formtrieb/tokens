# Changelog

All notable changes to `@formtrieb/tokens-render` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
