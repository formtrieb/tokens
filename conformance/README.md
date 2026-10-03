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
pnpm conformance                      # default fixture, compared with baseline.json
pnpm conformance --update-baseline    # pin the current state deliberately
pnpm conformance --tokens <dir>       # any Tokens-Studio export; add --baseline <file> to compare
```

The run writes `out/report.md` (per theme, per `$type`, every finding with
both values) and `out/result.json`. Both are ignored by git.

## Verdicts

Notation is allowed to differ; meaning is not. Each `$type` gets a canonical
form before comparing:

| Category | Meaning |
|---|---|
| `match` | same meaning (`#d62c18` = `rgb(84% 17% 9%)`, `16px` = `1rem`, `Bold` = `700`, `0px` = `0`) |
| `rounding` | colours one 8-bit step apart — the culori/colorjs gamut-mapping tie documented in tokens-core 1.3.0. Since FOR-498 both machines take colour from core, so any rounding finding is a regression |
| `divergent` | different meaning; the two machines would ship different values |
| `unparseable` | a value neither machine could have meant — a defect in the source, or an unresolved reference |
| `missing` | the token exists for one machine only |
| `composite` | object-valued (`typography`, `boxShadow`); counted, not yet compared |

## Baseline

`baseline.json` pins the current findings. `test/baseline.test.ts` fails when
a finding appears **or disappears** — a fix is a change too and is pinned on
purpose with `--update-baseline`, never silently.

## What the first run found (2026-10-03, the production design system export)

2455 tokens compared across 16 themes: 2430 match, 13 rounding, 8 divergent,
4 unparseable, 105 composite not compared.

- **letter-spacing is shipped 16× too small.** `-5%` becomes `-0.003125rem`
  (= −0.05 px) instead of `−0.05em`: sd-transforms turns `%` into `em`, then
  `size/pxToRem` treats the em number as px. core reports `-5%`. Six tokens.
  *Fixed in FOR-495: the resolver converts only px or unitless values to rem;
  the six findings left the baseline (now 2436 match, 2 divergent).*
- **`content.maxWidth` is shipped as invalid CSS.** `{breakpoints.tablet}-1px`
  leaves the pipeline as `var(--…-breakpoints-tablet)-1px` without `calc()`;
  core leaves `1024px-1px`. Neither machine can evaluate mixed-unit math.
- **The easing tokens are empty in the source** (`[{},{},{},{}]`); sd ships
  `cubic-bezier([object Object], …)`. Already noted in the customer lab.
- The 13 rounding cases are the four foundation colours documented in
  tokens-core 1.3.0 plus their semantic aliases.
  *Gone since FOR-498: the resolver computes colour modifiers with core
  instead of sd-transforms/colorjs (now 2449 match, 0 rounding).*

This instrument is scaffolding. Once core is the only reader and resolver,
the resolver's own snapshot test guards both sides and this folder can go.
