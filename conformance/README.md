# conformance

A measuring instrument, not a product. It sends every token of a real token
system through both machines this repository ships —

- **core**: `@formtrieb/tokens-core`, driven exactly as `tokens-mcp` drives it
  in `resolve_token` (compose theme → `ReferenceResolver`), and
- **sd**: the Style-Dictionary pipeline of `@formtrieb/token-resolver`, with
  the same source/include split, preprocessor and transform list as
  `buildTheme`, read through `getPlatformTokens` —

and lists where the two disagree. One theme is one comparison, because one
theme is one CSS block.

```bash
pnpm conformance                      # synthetic fixture, compared with baseline.json
pnpm conformance --update-baseline    # pin the current state deliberately
pnpm conformance --tokens <dir>       # any Tokens-Studio export; add --baseline <file> to compare
pnpm conformance --css                # whole resolver output vs @formtrieb/tokens-render, as text
pnpm conformance --css --tokens <dir> --config <resolver config>
```

The default is the synthetic fixture in `packages/resolver/tests/fixtures/tokens`
— customer-free, but with the same patterns as a production system: LCH ramps
built from helper numbers with zero-amount modifiers, math in helpers, alpha
chains with referenced multipliers, chained modifiers in lch/hsl/srgb, device
and shape axes, private `*` tokens, typography composites. A real system runs
through `--tokens <local path>`; it is never checked in.

The run writes `out/report.md` (per theme, per `$type`, every finding with
both values) and `out/result.json`. Both are ignored by git.

## `--css`: the output, file by file

The token mode compares meaning, token by token. `--css` compares bytes,
file by file. It is the instrument for replacing Style Dictionary with
`packages/render` (FOR-499).

- **sd**: `runPipeline` of the resolver with the given config, writing into
  a temp dir. The resolver's own output dir is read, never written.
- **render**: the render functions with `deriveRenderTable` from the same
  `$themes.json` and config.

Each file is `identical`, `allowed`, `diff`, `missing` (with the error of the
render step that owes it) or `extra`. A diff counts as `allowed` only when
every changed line on both sides matches a rule in `css-allowlist.json`.
There are exactly two rules, the deviations FOR-499 decided: `calc()` for
mixed-unit math on a reference (FOR-496), and no line for a value that is no
valid CSS (FOR-497). The run exits 1 while anything is red.

A real output dir holds more than generated files: a `main.css` with
hand-written `@import` lines, which the resolver keeps, and the files they
import, which the bundle inlines. Both are read from the config's
`paths.output` and handed to both machines (`seeded` in the report), so the
oracle is what the consumer actually ships. They are not compared.

Output: `out/css-report.md`, `out/css-result.json`, and both trees under
`out/css/{sd,render}` for a manual `diff -r`.

## Verdicts

Notation is allowed to differ; meaning is not. Each `$type` gets a canonical
form before comparing:

| Category | Meaning |
|---|---|
| `match` | same meaning (`#336699` = `rgb(20% 40% 60%)`, `16px` = `1rem`, `Bold` = `700`, `0px` = `0`) |
| `rounding` | colours one 8-bit step apart — the culori/colorjs gamut-mapping tie documented in tokens-core 1.3.0. Since FOR-498 both machines take colour from core, so any rounding finding is a regression |
| `divergent` | different meaning; the two machines would ship different values |
| `unparseable` | a value neither machine could have meant — a defect in the source, or an unresolved reference |
| `missing` | the token exists for one machine only |
| `composite` | object-valued (`typography`, `boxShadow`); counted, not yet compared |

## Baseline

`baseline.json` pins the current findings. `test/baseline.test.ts` fails when
a finding appears **or disappears** — a fix is a change too and is pinned on
purpose with `--update-baseline`, never silently.

## What the first run found (2026-10-03, a production export via `--tokens`)

2455 tokens compared across 16 themes: 2430 match, 13 rounding, 8 divergent,
4 unparseable, 105 composite not compared.

- **letter-spacing was shipped 16× too small.** `-5%` became `-0.003125rem`
  instead of `-0.05em`: sd-transforms turns `%` into `em`, then
  `size/pxToRem` treated the em number as px. *Fixed in FOR-495.*
- **A max-width with mixed-unit math ships as invalid CSS.**
  `{breakpoints.tablet}-1px` leaves the pipeline without `calc()`; core leaves
  `1024px-1px`. Neither machine can evaluate mixed-unit math. Open.
- **Empty easing tokens in the source** (`[{},{},{},{}]`) ship as
  `cubic-bezier([object Object], …)`. A source defect.
- **13 rounding cases**: colours one 8-bit step apart, culori vs colorjs.
  *Gone since FOR-498: the resolver computes colour modifiers with core.*

## What the synthetic fixture pins

304 match, 0 rounding, 1 divergent, 21 composite not compared.

- The divergent case is the mixed-unit max-width above, kept on purpose.
- Chained modifiers (`darken` on an lch ramp step, `srgb` lighten on one)
  used to land one 8-bit step apart: core rounded every intermediate colour
  to hex, the resolver carried the unrounded value on. *Since FOR-504 core
  rounds once, for output.*

This instrument is scaffolding. Once core is the only reader and resolver,
the resolver's own snapshot test guards both sides and this folder can go.
