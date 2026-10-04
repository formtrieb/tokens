# @formtrieb/tokens-render

**Renders a Tokens-Studio-shaped token system to CSS: variables per render
table, utility classes, `main.css`, bundle, token map. Pure functions over
the [`@formtrieb/tokens-core`](https://github.com/formtrieb/tokens/tree/main/packages/core)
tree. No file system, no console.**

## Status

Not published. Built next to the Style-Dictionary resolver (FOR-499) and
writing the same bytes: `pnpm conformance --css` at the repository root
compares the two, file by file. The resolver switches over in step 3d.

| Function | Returns | Lands in |
|---|---|---|
| `deriveRenderTable(themes, config)` | `RenderRule[]` | done |
| `renderVariables(system, rules, options)` | `variables/*.css` | done |
| `renderUtilities(system, builders, options, config?)` | `utilities/*` | done |
| `renderImports(files, existing?)` | `main.css` | done |
| `renderBundle(files)` | `bundle.css` | done |
| `renderTokenMap(system, options)` | `token-map.json` | done |

Every render function returns a `Map` of output file (relative to the CSS
output root) to content. Writing it is the caller's job.

## Builders

`typography`, `typographyMixin`, `directional`, `single`, `container` live
here; `@formtrieb/token-resolver/builders` re-exports them, so existing
configs stay as they are. A builder gets `{ tokens, config }`: every token
of the system (sets in `$metadata.json` order, first definition of a path
wins) and the caller's config. Custom builders written against the
resolver's `BuilderFn` keep working.

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

## How `renderVariables` writes a value

Byte for byte what the resolver wrote with Style Dictionary and
sd-transforms, because that CSS is in production:

- **Composition.** A theme's `source` sets, then its `enabled` sets, in
  `$themes.json` order, deep-merged: a later set wins, a key keeps its first
  position. Only tokens from `enabled` sets are written.
- **Meaning** comes from core's `canonicalize` steps, **presentation** from
  `src/css/`: px → rem by `basePxFontSize`, colours as `rgb(r, g, b)` /
  `rgba(…)` (a port of tinycolor2) or core's computed `rgb(r% g% b% / a)`,
  quoted font families, `font` / shadow / border shorthands, `cubic-bezier()`.
- **Literal or reference.** A token without references runs every step. A
  token with references takes its targets' finished values and runs only
  the transitive steps. So a line height pointing at a dimension ships in
  rem, a literal one in px, and a computed colour keeps its percentages.
- **`references: true`** writes `var(--…)` where the source referenced, in
  reference-safe order. A computed colour (`modify`) keeps its value.
- **One deliberate difference** in the output (FOR-496): arithmetic that
  cannot be reduced, like `{breakpoints.desktop}-1px`, is written as
  `calc(var(--…) - 1px)` instead of invalid CSS.
- **One change in how, not what:** typography companions
  (`-letter-spacing`, `-text-transform`, …, `-fvn`) follow
  `$type: typography` in the block, where the resolver looked for a group
  and a set both called `Typography`. Same bytes for every system where
  typography lives in such a set.

## License

Apache-2.0
