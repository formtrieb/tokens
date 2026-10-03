# @formtrieb/tokens-render

**Renders a Tokens-Studio-shaped token system to CSS: variables per render
table, utility classes, `main.css`, bundle, token map. Pure functions over
the [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core)
tree. No file system, no console.**

## Status

Not published. Under construction (FOR-499): it is being built next to the
Style-Dictionary resolver and replaces it once both write the same bytes.
Until then the render functions throw, and `pnpm conformance --css` at the
repository root shows every file red.

| Function | Returns | Lands in |
|---|---|---|
| `deriveRenderTable(themes, config)` | `RenderRule[]` | done |
| `renderVariables(system, rules, options)` | `variables/*.css` | 3b |
| `renderUtilities(system, builders, options)` | `utilities/*` | 3c |
| `renderImports(files, existing?)` | `main.css` | 3c |
| `renderBundle(files)` | `bundle.css` | 3c |
| `renderTokenMap(system, options)` | `token-map.json` | 3c |

Every render function returns a `Map` of output file (relative to the CSS
output root) to content. Writing it is the caller's job.

## The render table

One rule says which theme is written where, under which selector:

```ts
interface RenderRule {
  theme: string;      // `{group}/{name}` from $themes.json
  selector: string;   // ':root', '[data-mode="Dark"]', …
  media?: string;
  references: boolean; // var(--…) for references, or resolved values
  file: string;       // 'variables/mode.css'
}
```

The unit is the theme, not the set. The selector is the app's decision how it
switches themes, so the table belongs to the consumer's config.
`deriveRenderTable` gives the default the resolver has always written: a
group with one theme goes to `:root`, a group with several to
`[data-{group}="{name}"]`, one file per group, references per group from
`themeGroups` / `defaultGroupBehavior`.

render knows no set, group or theme name. Fallback order and special groups
come from the table or `$themes.json`, never from code;
`test/guard.test.ts` fails on a set name or a `Group/Name` literal in `src/`.

## License

Apache-2.0
