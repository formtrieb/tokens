# Changelog

All notable changes to `@formtrieb/tokens-core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-10-07

One resolution for MCP and CSS, and a smaller surface. Breaking.

### Added

- `namedSets(metadata, themes)` and `buildTokenSystem(files)`: the sets a
  token system has (those `$metadata.json` and `$themes.json` name, nothing
  else) and the system from its files; a named set without a file is
  reported.
- `compose(system, selection)` / `composeTheme(system, theme)` /
  `themeSelection(theme)`: the tokens of a selection of sets. Groups merge,
  a token replaces a token whole, a group's `$type` reaches the tokens below
  it, untyped tokens are kept and reported.
- `resolveDictionary` / `resolveToken`: every reference resolved
  (`{a.b}`, `{a.b.$value}`, in text, arrays, composites and modifiers),
  every value read under its type into a `TokenValue` at full precision,
  with the chain of visited tokens and the problems found. A bare number in
  a length type is px; a bare `0` keeps no unit.
- `referencesIn`, `textOf`, `alignType`.
- Colour: `parseColor` (also `rgba(<colour>, a)`), `cssColor` (the one way
  a colour is written: `rgb`, `hex`, `percent`, `srgb`), `modifyColor`
  (a Tokens Studio modifier on a colour; a base outside sRGB is mapped into
  it first).

### Changed

- `composite` is now `over`.
- `withAlpha` and `over` write alpha only when it is below 1:
  `withAlpha(c, 1)` is `#rrggbb`, not `#rrggbbff`.
- The analysis functions (`findPlaceholders`, `findBrokenReferences`,
  `compareStructure`, `check…`) take dictionary entries (`DictionaryEntry[]`)
  instead of `RawToken[]`.
- `findPlaceholders` documents what it checks: `#f305b7`.
- Design rules are data: `parseRules(data)` reads a rules file
  (`references`, `segments`, `depth`, `sibling-reference`; token and set
  patterns with `*` and `**`), `checkRules(entries, rules)` reports
  violations. `matchPath(pattern, path)` is the one pattern rule.

### Removed

- The former engine: `TokenTree`, `ReferenceResolver`, `evaluateMath`,
  `containsMath`, and the types `RawToken`, `TokenExtensions`,
  `ResolutionStep`, `ResolutionChain`.
- The Style-Dictionary-shaped value steps: `canonicalize`, `resolveMath`,
  `parseAndReduce`, `evaluateMathFor`, `pxFor`, `opacityFor`,
  `lineHeightFor`, `fontWeightFor`, `letterSpacingFor`.
- Colour helpers replaced by the above: `applyColorModifier`,
  `formatColor`, `resolveLchToHex`, `resolveLchToHexWithGamut`,
  `isLchFormula`, `isPlainColor`; the types `ColorFormat`,
  `ModifierOutput`, `Oklch`, `ColorOutput`, `ColorMatchResult`,
  `NearestColorMatch`.
- `checkControlsInteractionMapping`, `checkComponentReferences`,
  `checkNamingConventions`: their rules are now a rules file (`checkRules`).
- Theme helpers without use: `getActiveSets`, `getAxisGroups`,
  `getThemesForGroup`, `UNGROUPED_AXIS`, and the types `RawTheme`,
  `AxisDescriptor`, `TokenSetInfo`.

### Migrating from 1.x

| 1.x | 2.0 |
|---|---|
| `new TokenTree(sets, order)` + `getActiveSets` + `buildMergedTree` + `new ReferenceResolver(merged).resolve(path)` | `buildTokenSystem(files)`, then `resolveDictionary(composeTheme(system, "Group/Name"))` or `compose(system, selection)`; `values.get(path)` gives `{ value, chain, problems }` |
| `chain.finalValue` (raw string) | `resolution.value` (typed); write it with `cssColor`, `textOf`, or `@formtrieb/tokens-render` |
| `chain.errors` (strings) | `resolution.problems` (`{ kind: "unknown-reference" \| "cycle" \| … }`) |
| `chain.gamutClipped`, `chain.lchValue` | `value.outOfGamut`, `value.literal` |
| `applyColorModifier(hex, modifier)` | `cssColor(modifyColor(parseColor(hex)!, { type, amount, space }), "hex")` |
| `formatColor(value, "rgba" \| "hex8" \| "hex")` | `cssColor(parseColor(value)!, "rgb" \| "hex")` |
| `composite(layer, base)` | `over(layer, base)` |
| `withAlpha(c, 1)` → `#rrggbbff` | `#rrggbb` |
| `canonicalize(value, type)` | the value of `resolveDictionary`, already read under its type |
| analysis functions with `RawToken[]` | pass `DictionaryEntry[]` (`dict.entries`) |
| `checkControlsInteractionMapping` / `checkComponentReferences` / `checkNamingConventions` | write the rules as data and call `checkRules(entries, parseRules(file))` |

## [1.7.1] — 2026-10-06

### Fixed

- `mapToSrgbGamut` returns a colour inside sRGB unchanged instead of
  round-tripping it through OKLCH, which nudged colours on the gamut edge
  (`#ff0000` came back with r ≈ 0.9999) and could tip a value on a
  rounding boundary in colour modifiers and `lch()`. Only colours outside
  sRGB are mapped.

## [1.7.0] — 2026-10-06

### Added

- `composite()` and `withAlpha()` take `{ format: "srgb" }` and then return
  `color(srgb r g b / a)` at full precision instead of 8-bit hex. For code
  that chains several steps and measures the result; the default output is
  unchanged.
- `alphaOf(color)`: a colour's alpha, 0..1.

## [1.6.0] — 2026-10-06

### Added

- General colour functions for code that generates or checks colours:
  `oklchToHex(l, c, h)` (gamut-mapped like every other colour path here),
  `hexToOklch(color)`, `contrastWcag(a, b)`, `deltaE2000(a, b)`,
  `deltaEOK(a, b)`, `composite(layer, base)` (source-over in sRGB) and
  `withAlpha(color, alpha)`. New exported type `Oklch`. An unparseable colour
  throws a `TypeError`.

## [1.5.0] — 2026-10-04

### Added

- `canonicalize(value, $type)` and its single steps (`resolveMath`,
  `evaluateMathFor`, `pxFor`, `opacityFor`, `lineHeightFor`,
  `fontWeightFor`, `letterSpacingFor`, `alignType`): the Tokens Studio
  meaning of a resolved value — math, bare numbers as px, `%` opacity, line
  height and letter-spacing, named font weights — with the exact rules of
  `@tokens-studio/sd-transforms` 2, so `@formtrieb/tokens-render` can write
  the CSS that Style Dictionary wrote. Additive: `ReferenceResolver` and
  `tokens-mcp` keep returning the raw `finalValue`.

## [1.4.0] — 2026-10-03

### Added

- `applyColorModifier(base, modifier, output)` takes an output form:
  `"hex"` (default, unchanged) or `"srgb"` — unrounded `rgb(r% g% b% / a)` at
  five significant digits, the shape `@tokens-studio/sd-transforms` writes
  with `format: 'srgb'`. `@formtrieb/token-resolver` ships this form, so the
  generated CSS and `tokens-mcp` now take colour from one implementation.
  New exported type `ModifierOutput`.
- `mix` modifier (`modify.color` is the colour to mix towards; may be a token
  reference).
- `lighten` / `darken` honour the modifier's `space`: `hsl`, `srgb` and `p3`
  next to `lch`, formula for formula as sd-transforms has them. An unknown
  space still falls back to `lch`.

### Fixed

- **Colour is rounded once, for output.** The reference resolver rounded every
  intermediate colour to hex — an `lch()` value before its modifier, a
  modifier's result before the next one. Chains could land one 8-bit step
  away from the CSS. It now carries the unrounded value through the chain.
- A composite whose first reference resolved to a number left every later
  reference unresolved (`{"x": 4, "y": "{b}"}`): a `/g` regex carried
  `lastIndex` from one test into the next.
- A wide, acyclic reference graph was resolved once per path — `2^depth`
  visits. Each token is now resolved once per `resolve()` call. A token reached
  twice in one chain appears once in `chain.steps`.

**Colour values change** for tokens with `hsl`/`srgb`/`p3` lighten/darken
(previously computed as `lch`) and for some modifier chains (one 8-bit step).
No signatures changed.

## [1.3.0] — 2026-08-23

### Fixed

- `applyColorModifier` now matches `@tokens-studio/sd-transforms`, the canonical
  implementation of Tokens Studio's `modify` extension. Three divergences are
  corrected: lightness moved by a fraction of the remaining distance rather than
  by an absolute step, chroma scaled down with the amount, and out-of-gamut
  results gamut-mapped (CSS Color 4 §13) instead of clipped per channel.
- Every `lch()` value resolved through `resolveLchToHex` and
  `resolveLchToHexWithGamut` is now gamut-mapped rather than clipped. This
  affects any token whose value lands outside sRGB, with or without a modifier —
  for a ramp authored with high chroma, that is most steps.
- `lighten`/`darken` applied on top of an already-transparent base no longer
  discards the alpha channel. `applyColorModifier` returns `rgba(r, g, b, a)`
  for such colours instead of an opaque `#rrggbb`; opaque bases are unchanged.

**Colour values change.** `resolve_token` and `resolve_batch` will report
different colours than 1.2.0 did for affected tokens. The new values are the
ones the generated CSS ships. No API signatures changed.

Two gamut-mapping implementations are involved — culori here, colorjs.io in
the generator — and they can land on adjacent 8-bit values. Measured across
the foundation palette: 134 of 138 colour variables match the shipped CSS
exactly; 4 differ by 1/255, all of them out-of-gamut colours.

## [1.2.0] — 2026-08-19

### Added

- **`describeAxes(axisMap)`** — the axes a token system actually offers, each with
  its values and the value `getDefaultAxes()` falls back to. Consumers cannot know
  the axes up front: they are whatever `$themes.json` groups its themes by, and
  differ per design system.
- **`validateAxes(axisMap, axes)`** — checks an axis selection against the loaded
  themes and returns a structured problem per unknown axis or unknown value,
  including a `suggestion` when only the casing differs. `getActiveSets()` skips
  anything it cannot match, so without this check a typo resolves silently against
  the wrong token sets.
- **`UNGROUPED_AXIS`** — the axis name collecting themes that carry no `group`.
- **`RawTheme`** is now exported; its `group` field is optional, matching what
  Tokens Studio actually writes.

### Fixed

- **Themes without a `group` no longer produce an axis literally named
  `"undefined"`.** `parseThemes` mapped a missing `group` straight through, so it
  became an `undefined` key in the axis map and stringified to `"undefined"` in
  `getDefaultAxes()`. Such themes now collect under `UNGROUPED_AXIS`
  (`"Ungrouped"`) and are addressable like any other axis. A blank or
  whitespace-only `group` is treated the same way.

## [1.1.2] — 2026-05-31

### Added

- **`formatColor(value, format)`** — renders a resolved colour as `"rgba"`
  (`rgb()`/`rgba()`), `"hex8"` (`#rrggbbaa`), or `"hex"` (`#rrggbb`). Lets callers
  normalize a mix of `#hex` (plain + lighten/darken) and `rgba(...)` (alpha)
  results into one representation. Non-colour values pass through untouched.
- **`findColorMatches(query, candidates, opts)`** — reverse-lookup from a colour
  value to the token paths that produce it. Exact match is format/casing-insensitive
  (both sides normalized to `#rrggbbaa`); `opts.nearest` adds the perceptually
  closest non-exact candidate by CIEDE2000 ΔE. Non-colour candidates are skipped.

### Fixed

- **`lighten`/`darken` colour modifiers now compute from the base colour, not
  black.** `applyColorModifier` read the `.l/.c/.h` LCH channels off an sRGB-parsed
  culori object, where they are `undefined` (→ `0`), so every lighten/darken
  rebuilt from `lch(0 0 0)`. The base is now converted to LCH first. Fixes 30
  reference DS tokens (icon tints, hover states) that previously resolved to
  near-black garbage.

## [1.1.1] — 2026-05-31

### Fixed

- **Reference-valued colour modifiers are now composed into `finalValue`.**
  When a `studio.tokens.modify` block's `value` was itself a token reference
  (e.g. an `alpha` modifier whose multiplier is
  `{color.text.lightness.multiplier.secondary}`), the reference was passed
  verbatim to `parseFloat`, yielding `NaN`, so the modifier was silently
  dropped and `finalValue` fell back to the unmodified base colour. The
  modifier `value` is now reference-resolved against the token map before the
  modifier is applied. Literal-valued modifiers (the common case) are
  unchanged. Alpha-driven colours (semantic text tiers, etc.) now resolve to
  their true `rgba(…)` value instead of the opaque base. 3 new tests in
  `test/reference-resolver.test.ts`.

## [1.1.0] — 2026-05-10

### Added

- **`ResolutionStep.modifier?: ColorModifier`.** When a token carries a
  `$extensions.studio.tokens.modify` block, the corresponding
  resolution step now exposes the modifier verbatim. Previously the
  modifier was applied to `finalValue` invisibly — callers could see
  the post-modification colour but not the operation that produced it.
  This is the missing signal for tools that need to round-trip or
  reason about derived tokens (e.g. brand-iteration loops where an LLM
  edits source tokens and inspects what was applied where). Field is
  optional and only present on steps whose token defines a `modify`.

No breaking changes: the addition is strictly additive on an existing
optional shape. Consumers that destructure only `tokenPath`,
`rawValue`, `sourceSet` are unaffected.

## [1.0.0] — 2026-05-09

### Initial public release

Extracted from `formtrieb-tokens-core@1.0.0` (private; identical surface).
The library has shipped under `workspace:*` inside the Formtrieb monorepo
since 2026-03; this version strips the monorepo-internal coupling and
re-publishes as a standalone npm package under the `@formtrieb/` scope.

**Surface (no breaking changes vs. private 1.0.0).**

- `TokenTree` — DTCG-aware walker over Tokens-Studio set files
- `ReferenceResolver` — resolves `{token.references}` chains with full step path
- Theme composition — `parseThemes`, `buildAxisMap`, `getActiveSets`,
  `getDefaultAxes`, `getAxisGroups`, `getThemesForGroup`, `getThemeByName`
- Color resolution — `resolveLchToHex`, `applyColorModifier`,
  `isLchFormula`, `isPlainColor`, `isInSrgbGamut`, `resolveLchToHexWithGamut`
- Math evaluation — `evaluateMath`, `containsMath`
- Validation — `findPlaceholders`, `findBrokenReferences`, `compareStructure`
- Design rules — `checkControlsInteractionMapping`,
  `checkComponentReferences`, `checkNamingConventions`
- Types — `RawToken`, `TokenExtensions`, `ColorModifier`, `ResolutionStep`,
  `ResolutionChain`, `ThemeDefinition`, `ThemeAxes`, `TokenSetInfo`,
  `DesignRuleViolation`, `PlaceholderToken`, `StructuralDiff`

License: Apache-2.0. Requires Node ≥ 20.
