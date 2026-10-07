# @formtrieb/tokens-cli

Tokens-Studio JSON → CSS variables, utility classes, SCSS mixins, and Figma↔CSS lookup map. Driven by a project-local config. The CSS comes from [`@formtrieb/tokens-render`](https://github.com/formtrieb/tokens/tree/main/packages/render) on top of [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core).

Up to 0.7 this package was published as `@formtrieb/token-resolver`. Moving over means changing the package name in `package.json` and in the imports (`@formtrieb/tokens-cli`, `@formtrieb/tokens-cli/builders`); the command `formtrieb-tokens` and the config files stay as they are.

## Install

```bash
npm install --save-dev @formtrieb/tokens-cli
```

Your consumer project's `package.json` must have `"type": "module"` (this package is ESM-only). The CLI loads `.ts`, `.mjs`, and `.js` config files.

## Quick start

Create `formtrieb-tokens.config.ts` in your project root:

```ts
import { defineConfig } from '@formtrieb/tokens-cli';
import {
  typography,
  typographyMixin,
  directional,
  container,
} from '@formtrieb/tokens-cli/builders';

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

### What the resolver owns in the output folder

- **`variables/`**: the build writes and overwrites the files the render
  table names. It deletes nothing. Any other `.css` file there is neither
  rendered nor imported, and the build names it in a warning: check that
  nothing still reads from it, then delete it.
- **`utilities/`**: when `utilities` builders are configured, the folder is
  emptied and rewritten on every build. Do not keep your own files in it.
  Without builders it is left alone, and its `.css` files get the same
  warning.
- **`main.css`**: the comment lines and every `@import` of `./variables/` or
  `./utilities/` are regenerated. All other lines, such as
  `@import './reset.css';`, are kept on top.
- **`bundle.css`** and **`token-map.json`** are overwritten. Hand-written
  imports in `main.css` are inlined into `bundle.css` from disk.

Everything else in the output folder belongs to you.

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

That default is a derived **render table**: one rule per theme, a group with one theme goes to `:root`, a group with several to `[data-{group}="{name}"]`, one file per group, references per group from `themeGroups` / `defaultGroupBehavior`. How an app switches themes is the app's decision, so the table can be set in the config instead:

```ts
render: [
  { theme: 'Foundation/Foundation', selector: ':root', references: false, file: 'variables/foundation.css' },
  { theme: 'Mode/Light', selector: ':root', references: true, file: 'variables/mode.css' },
  { theme: 'Mode/Dark', selector: '.dark', references: true, file: 'variables/mode.css' },
  { theme: 'Mode/Dark', selector: ':root', media: '(prefers-color-scheme: dark)', references: true, file: 'variables/mode.css' },
],
```

`theme` is `{group}/{name}` from `$themes.json`. Rules writing to the same file become blocks of that file, in table order. Which set overrides which comes from the theme in `$themes.json`, never from the table.

## Render file

`render` can name a JSON file instead of listing rules. The file is either a bare list of rules or the rules with the output options the tree was written for:

```json
{
  "options": { "units": "source", "color": "source", "typographyCompanions": false },
  "rules": [{ "theme": "Base/Base", "selector": ":root", "references": true, "file": "variables/base.css" }]
}
```

Allowed options are `prefix`, `units`, `basePxFontSize`, `color` and `typographyCompanions` (see [`@formtrieb/tokens-render`](https://github.com/formtrieb/tokens/tree/main/packages/render#units) for the unit policy). Each option is taken from the config first, then from the file, then from the CLI default. The config's `prefix` is required, so it always wins. When the config sets a different value than the file, the build warns once per option and uses the config.

A render file or config that still names a `dialect` is refused: write the options instead — what `"canonical"` meant is `"units": "source", "color": "source", "typographyCompanions": false`, what `"style-dictionary"` meant is `"units": "tokens-studio", "color": "rgb", "typographyCompanions": true`. A `render.json` written by `@formtrieb/tokens-recipe` before 0.4.0 is generated anew by running the recipe again.

## Invalid values

A value that would be no valid CSS stops the build, and nothing is written. The error lists every such token with path, theme and file — for example an easing token with an empty bezier (`[{}, {}, {}, {}]`), a reference to a token that does not exist, or arithmetic CSS cannot compute (`2px * 3rem`). Math on a reference, like `{breakpoints.tablet}-1px`, is written as `calc(var(--…) - 1px)`, irreducible math like `80rem - 16px` as `calc(80rem - 1rem)`.

## CLI Reference

```
formtrieb-tokens [options]

Options:
  -w, --watch              Re-run pipeline on tokens/ changes
  -c, --config <path>      Override config-file location
  -h, --help               Show usage
```

The CLI auto-discovers `formtrieb-tokens.config.{ts,mjs,js}` by walking from `cwd` up to the filesystem root.

## Check

```
formtrieb-tokens check [--config <path>] [--rules <file>] [--axis <name>]
                       [--severity error|warning|info] [--json]
```

Checks the token system and writes nothing — for CI before the build:

- **Resolution**, per theme of the render table: references to nothing or to a group, cycles, missing sets and invalid values (errors), untyped tokens and a token replacing a group (warnings).
- **Design rules**, when there are any: `--rules <file>`, else `tokens.rules.json` in the folder that holds `paths.tokens` (not inside it: Tokens Studio reads every JSON file there as a token set). The rules format is `parseRules` in [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core).
- **Broken references** over all sets, and **parity** of the themes of one axis (`--axis`, by default the first with more than one theme).

Exit code 0 when nothing reaches `--severity` (default `error`), 1 when a finding does, 2 for a usage error (unknown option, malformed rules file, unknown axis). Findings from `warning` up are shown either way (`info` too with `--severity info`). `--json` prints the report in the form of the MCP server's `check_design_rules`, plus `passed` and `threshold`; the summary counts rule and resolution findings, not `brokenReferences`, since a reference to nothing also shows in the resolution.

## Config reference

| Key                          | Type                                  | Default  | Purpose                                                                                                                              |
| ---------------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `prefix`                     | `string`                              | required | CSS variable + utility-class prefix (e.g. `ds-` → `--ds-color-…`, `.ds-display-1`).                                                  |
| `paths`                      | `{ tokens, output, tokenMap }`        | required | Input tokens dir, CSS output dir, and token-map JSON path.                                                                           |
| `output.bundle`              | `boolean`                             | `true`   | Whether to emit `bundle.css` (everything inlined). Set `false` if consumers always pull `main.css` and you don't need the bundle.    |
| `privateTokenPrefixes`       | `string[]`                            | `['*']`  | Path-segment prefixes that mark a token as private — excluded from CSS output **and** from `token-map.json`. Default hides `*foo` segments. |
| `themeGroups`                | `Record<string, { useReferences }>`   | `{}`     | Per-theme-group behavior. `useReferences: false` inlines raw values; `true` emits `var(...)` references.                            |
| `defaultGroupBehavior`       | `{ useReferences }`                   | —        | Fallback for any group not listed in `themeGroups`.                                                                                  |
| `typography.fontVariantNumeric.tabular` | `string[][]`               | `[]`     | Token-path prefixes whose typography tokens get a `tabular-nums` font-variant. See [Typography](#typography).                       |
| `utilities`                  | `BuilderFn[]`                         | `[]`     | Builders that emit utility CSS / SCSS files. Order matters for output filenames only.                                                |
| `render`                     | `RenderRule[] \| string`             | derived  | The render table: which theme goes to which file under which selector. Rules, or a path (from `cwd`) to a render file. See [Theme Switching](#theme-switching) and [Render file](#render-file). |
| `units`                      | `UnitPolicy \| 'tokens-studio' \| 'source'` | `'tokens-studio'` | Unit policy: which unit a length in px is written in, per Tokens Studio type and path. `'tokens-studio'`: sizes and spacing in rem, borders and shadows in px. Overrides the render file. |
| `basePxFontSize`             | `number`                              | `16`     | Root font size px are divided by for rem. Overrides the render file. |
| `color`                      | `'source' \| 'rgb' \| 'hex'`         | `'rgb'`  | How colour literals are written. Overrides the render file. |
| `typographyCompanions`       | `boolean`                             | `true`   | Companion variables (`-letter-spacing`, `-text-transform`, …) next to each typography token; the `typography` builders need them. Overrides the render file. |

## Programmatic API

```ts
import { runPipeline } from '@formtrieb/tokens-cli';
import config from './formtrieb-tokens.config.ts';

await runPipeline(config);
// or partial: await runPipeline(config, { only: ['utilities'] });
```

## License

[Apache-2.0](./LICENSE). Versions up to 0.4.0 were published under MIT.
