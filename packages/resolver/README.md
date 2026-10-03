# @formtrieb/token-resolver

Tokens-Studio JSON → CSS variables, utility classes, SCSS mixins, and Figma↔CSS lookup map. Driven by a project-local config.

## Install

```bash
npm install --save-dev @formtrieb/token-resolver
```

Your consumer project's `package.json` must have `"type": "module"` (this package is ESM-only). The CLI loads `.ts`, `.mjs`, and `.js` config files.

## Quick start

Create `formtrieb-tokens.config.ts` in your project root:

```ts
import { defineConfig } from '@formtrieb/token-resolver';
import {
  typography,
  typographyMixin,
  directional,
  container,
} from '@formtrieb/token-resolver/builders';

export default defineConfig({
  prefix: 'ds-',
  paths: {
    tokens: './tokens',
    output: './src/css',
    tokenMap: './src/tokens/token-map.json',
  },
  output: { bundle: true },
  privateTokenPrefixes: ['*'],
  themeGroups: {
    Foundation: { useReferences: false },
  },
  defaultGroupBehavior: { useReferences: true },
  typography: {
    fontVariantNumeric: {
      tabular: [['mono'], ['metric'], ['table', 'numeric']],
    },
  },
  utilities: [
    typography(),
    typographyMixin(),
    directional({
      name: 'p',
      source: 'spacing.component.*',
      property: 'padding',
      sides: ['t', 'b', 's', 'e', 'x', 'y', 'all'],
    }),
    container({
      name: 'content',
      rules: {
        'max-width': '{content.max-width}',
        'padding-inline': '{layout.grid.margin}',
        'margin-inline': 'auto',
      },
    }),
  ],
});
```

Build:

```bash
npx formtrieb-tokens
```

Watch:

```bash
npx formtrieb-tokens --watch
```

## Output

For the example above, the generator produces:

```
src/css/
  variables/
    foundation.css       (raw values; useReferences: false)
    mode.css             ([data-mode="…"] selectors)
    typography.css       (with text-indent, margin-block-end, -fvn vars)
    …
  utilities/
    typography.css       (.ds-display-1, .ds-display-1--paragraph, …)
    p.css                (.ds-p-md, .ds-p-t-md, .ds-p-s-md, …)
    content.css          (.ds-content)
    _typography.scss     (SCSS @mixin partial, from typographyMixin())
  main.css               (@imports of variables/* + utilities/*)
  bundle.css             (everything inlined for library consumers)
src/tokens/
  token-map.json         (figma↔css lookup map)
```

`bundle.css` is only emitted when `output.bundle !== false` (default `true`).

## Builders

| Builder            | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| `single`           | One CSS property per token, one class per token.                |
| `directional`      | Property with logical-axis sides (t/b/s/e/x/y/all), RTL-aware. |
| `container`        | Multi-rule class mixing token references and CSS literals.     |
| `typography`       | Type-driven typography classes with `--paragraph` helper.      |
| `typographyMixin`  | SCSS mixin partial — same data, different output format.       |

### Logical-Property Side Mapping (directional)

| Side  | CSS                            | LTR    | RTL    |
| ----- | ------------------------------ | ------ | ------ |
| `t`   | `padding-block-start`          | top    | top    |
| `b`   | `padding-block-end`            | bottom | bottom |
| `s`   | `padding-inline-start`         | left   | right  |
| `e`   | `padding-inline-end`           | right  | left   |
| `x`   | `padding-inline`               | both   | both   |
| `y`   | `padding-block`                | both   | both   |
| `all` | `padding`                      | all    | all    |

For full builder API and design rationale, see [docs/specs/2026-05-08-token-resolver-package-design.md](./docs/specs/2026-05-08-token-resolver-package-design.md).

## Typography

`typography()` emits utility classes; `typographyMixin()` emits the same data as an SCSS partial (`_typography.scss`) for projects that prefer `@include` over class names:

```scss
@use 'path/to/_typography' as t;

.headline { @include t.typography('display-1'); }
.lede     { @include t.typography-paragraph('body-base-default'); }
```

Both outputs cover `font` shorthand, `letter-spacing`, `text-transform`, `text-decoration`, plus `text-indent` / `margin-block-end` for the `--paragraph` helper.

### Tabular numbers (font-variant-numeric)

Mark token families that should render with `tabular-nums` via `typography.fontVariantNumeric.tabular`. Each entry is a token-path prefix; any typography token whose path starts with one of these segments (case-insensitive) gets a `--{prefix}{token}-fvn: tabular-nums;` custom property, applied automatically by both `typography()` and `typographyMixin()`:

```ts
typography: {
  fontVariantNumeric: {
    tabular: [
      ['mono'],              // every token under `mono.*`
      ['metric'],            // every token under `metric.*`
      ['table', 'numeric'],  // only `table.numeric.*`
    ],
  },
},
```

Non-tabular tokens fall back to `normal` via the mixin's default.

## Theme Switching

Multi-theme groups in `$themes.json` produce `[data-{group}="{name}"]` selectors automatically. Toggle a theme by setting the corresponding HTML attribute — no JS framework required:

```html
<html data-mode="dark" data-device="mobile">
```

## CLI Reference

```
formtrieb-tokens [options]

Options:
  -w, --watch              Re-run pipeline on tokens/ changes
  -c, --config <path>      Override config-file location
  -h, --help               Show usage
```

The CLI auto-discovers `formtrieb-tokens.config.{ts,mjs,js}` by walking from `cwd` up to the filesystem root.

## Config reference

| Key                          | Type                                  | Default  | Purpose                                                                                                                              |
| ---------------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `prefix`                     | `string`                              | required | CSS variable + utility-class prefix (e.g. `mp-` → `--ds-color-…`, `.ds-display-1`).                                                  |
| `paths`                      | `{ tokens, output, tokenMap }`        | required | Input tokens dir, CSS output dir, and token-map JSON path.                                                                           |
| `output.bundle`              | `boolean`                             | `true`   | Whether to emit `bundle.css` (everything inlined). Set `false` if consumers always pull `main.css` and you don't need the bundle.    |
| `privateTokenPrefixes`       | `string[]`                            | `['*']`  | Path-segment prefixes that mark a token as private — excluded from CSS output **and** from `token-map.json`. Default hides `*foo` segments. |
| `themeGroups`                | `Record<string, { useReferences }>`   | `{}`     | Per-theme-group behavior. `useReferences: false` inlines raw values; `true` emits `var(...)` references.                            |
| `defaultGroupBehavior`       | `{ useReferences }`                   | —        | Fallback for any group not listed in `themeGroups`.                                                                                  |
| `typography.fontVariantNumeric.tabular` | `string[][]`               | `[]`     | Token-path prefixes whose typography tokens get a `tabular-nums` font-variant. See [Typography](#typography).                       |
| `utilities`                  | `BuilderFn[]`                         | `[]`     | Builders that emit utility CSS / SCSS files. Order matters for output filenames only.                                                |

## Programmatic API

```ts
import { runPipeline } from '@formtrieb/token-resolver';
import config from './formtrieb-tokens.config.ts';

await runPipeline(config);
// or partial: await runPipeline(config, { only: ['utilities'] });
```

## License

MIT
