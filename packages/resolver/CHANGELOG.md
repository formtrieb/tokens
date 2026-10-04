# Changelog

All notable changes to `@formtrieb/token-resolver` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The utility builders (`typography`, `typographyMixin`, `directional`,
  `single`, `container`) moved to `@formtrieb/tokens-render`;
  `@formtrieb/token-resolver/builders` re-exports them, so configs stay
  unchanged. Output is byte-identical (E2E snapshot unchanged). New
  dependency `@formtrieb/tokens-render` — it has to be published before
  the next release of this package.

## [0.5.0] — 2026-10-03

### Changed

- **Colour modifiers are computed by `@formtrieb/tokens-core`** (new
  dependency) instead of sd-transforms/colorjs. The transform group is now
  `formtrieb/tokens-studio`: sd-transforms' group with `ts/color/modifiers`
  replaced by `formtrieb/color/modifiers`. Output keeps its shape,
  `rgb(r% g% b% / a)`. Out-of-gamut colours may move below one 8-bit step, and
  a few by exactly one step, where the two libraries' gamut mapping differed.
- License: Apache-2.0 (0.1.0–0.4.0 were MIT).
- Developed in the [formtrieb/tokens](https://github.com/formtrieb/tokens)
  monorepo.

### Fixed

- **Letter-spacing ships as `em`, not 16× too small.** sd-transforms turns
  `-5%` into `-0.05em` and retypes the token as `dimension`; Style
  Dictionary's `size/pxToRem` then read `0.05` as px and wrote `-0.003125rem`.
  The resolver now converts only px or unitless values to rem (`em`, `rem`,
  `%` stay as they are). `0%` ships as `0em`.

