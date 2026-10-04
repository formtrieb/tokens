# Changelog

All notable changes to `@formtrieb/token-resolver` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — 2026-10-04

**Upgrading:** configs stay as they are. Two things can change for you: a
mixed-unit expression on a reference now ships as `calc(…)`, and a token
whose value is no valid CSS (for example an easing with an empty bezier,
`[{}, {}, {}, {}]`) now stops the build and names the token — fix it in
the source.

### Changed

- **No Style Dictionary any more.** `runPipeline` writes what
  `@formtrieb/tokens-render` produces; `style-dictionary`,
  `@tokens-studio/sd-transforms` and `change-case` are gone from the
  dependencies. The output is byte-identical except for the two fixes
  below (E2E snapshot: two lines).
- `main.css` imports what this run rendered, no longer every `.css` file
  found in `variables/` — a stale file left by a removed theme group is no
  longer imported.
- The `typography()` builder no longer requires a theme group called
  `Typography`.
- The utility builders (`typography`, `typographyMixin`, `directional`,
  `single`, `container`) moved to `@formtrieb/tokens-render`;
  `@formtrieb/token-resolver/builders` re-exports them, so configs stay
  unchanged. Output is byte-identical (E2E snapshot unchanged).
  New dependency `@formtrieb/tokens-render`.

### Added

- `render` config option: the render table (rules, or a path to a JSON file
  of rules). Default derived from `$themes.json` as before.

### Fixed

- Mixed-unit math on a reference (`{breakpoints.tablet}-1px`) is written as
  `calc(var(--…) - 1px)` instead of invalid CSS (FOR-496).
- A value that is no valid CSS — an empty bezier written as
  `cubic-bezier([object Object], …)`, an unresolved reference, irreducible
  arithmetic — stops the build with token path, theme and file instead of
  being written (FOR-497).

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

