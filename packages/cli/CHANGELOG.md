# Changelog

All notable changes to `@formtrieb/tokens-cli` are documented here. Up to
0.7.0 the package was published as `@formtrieb/token-resolver`; those entries
are below under their versions.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-10-07

### Added

- `formtrieb-tokens check`: checks the token system without writing —
  resolution problems per theme of the render table, design rules from
  `--rules` or `tokens.rules.json` next to the token folder, broken
  references, parity over an axis. Exit 0 / 1 (a finding at or above
  `--severity`, default `error`) / 2 (usage error); `--json` prints the
  report in the form of the MCP server's `check_design_rules`.

## [1.0.0] — 2026-10-07

### Changed (breaking)

- Renamed to `@formtrieb/tokens-cli`. Change the package name in
  `package.json` and the imports: `@formtrieb/token-resolver` →
  `@formtrieb/tokens-cli`, `@formtrieb/token-resolver/builders` →
  `@formtrieb/tokens-cli/builders`. Nothing else: the command
  `formtrieb-tokens`, the config files and the options of a config stay.
- The builder and config types come from `@formtrieb/tokens-render`
  (`BuilderToken`, `TypographyOptions`, `GroupBehavior`); the former names
  `Token`, `TypographyConfig`, `ThemeGroupBehavior` remain as deprecated
  aliases.
- Config keys `units` (a unit policy or preset), `color` (`'source'`,
  `'rgb'`, `'hex'`) and `typographyCompanions` replace `dialect`. CLI
  defaults are the Tokens-Studio policy: `units: 'tokens-studio'`,
  `color: 'rgb'`, `typographyCompanions: true`.
- A render file with `dialect: "canonical"` keeps its meaning (lengths and
  colours as written, no companions) and the build warns once;
  `dialect: "style-dictionary"` is refused.
- Output of the default policy: variables in source order, references in
  composites at their own property's position, computed colours as
  `rgb(r% g% b%)`, colour literals in shadows as `rgba(r, g, b, a)`, every
  file ending with a newline.
- The token system is read with core's `buildTokenSystem`: only
  `$metadata.json`, `$themes.json` and the sets they name are read, each
  inside the token folder (symbolic links resolved). A JSON file no index
  names is no set any more; a set named without a file is reported.

### Migrating

| Before | Now |
|---|---|
| `dialect: 'style-dictionary'` (the default) | nothing: the CLI defaults write the same (`units: 'tokens-studio'`, `color: 'rgb'`, `typographyCompanions: true`) |
| `dialect: 'canonical'` | `units: 'source', color: 'source', typographyCompanions: false`; a render file that still says `dialect: "canonical"` keeps working, with a warning |
| `units: 'rem'` | `units: 'tokens-studio'` or a policy |
| a set file that no index names | name it in `$metadata.json` or a theme |

## [0.7.0] — 2026-10-06

### Added

- `render` may name a render file of the form `{ options?, rules }`. Its
  `dialect`, `basePxFontSize`, `units` and `color` apply unless the config
  sets them; a bare list of rules works as before.
- Config keys `dialect`, `basePxFontSize`, `units` and `color`, passed to
  the renderer. When the config sets a different `dialect` or
  `basePxFontSize` than the render file, the build warns and uses the config.

## [0.6.1] — 2026-10-06

### Added

- After writing `main.css`, the build names every `.css` file in
  `variables/` and `utilities/` that it did not render. Since 0.6.0 nothing
  imports such a file. The build only warns and deletes nothing.

## [0.6.0] — 2026-10-04

**Upgrading:** configs stay as they are. Two things can change for you: a
mixed-unit expression on a reference now ships as `calc(…)`, and a token
whose value is no valid CSS (for example an easing with an empty bezier,
`[{}, {}, {}, {}]`) now stops the build and names the token — fix it in
the source.

**Breaking for output folders with leftovers** (added after release):
`main.css` and `bundle.css` no longer pick up `.css` files in `variables/`
that the build did not render. If such a file is still there, for example
from a removed theme group or an older setup, and your code reads custom
properties from it, those properties are gone after the upgrade. Before
upgrading, list `variables/`, compare it with what the build writes, and
check each extra file for variables still in use. Move them to real
tokens, then delete the file.

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
  `calc(var(--…) - 1px)` instead of invalid CSS.
- A value that is no valid CSS — an empty bezier written as
  `cubic-bezier([object Object], …)`, an unresolved reference, irreducible
  arithmetic — stops the build with token path, theme and file instead of
  being written.

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

