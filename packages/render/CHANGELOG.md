# Changelog

All notable changes to `@formtrieb/tokens-render` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
