# Changelog

All notable changes to `@formtrieb/tokens-render` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
