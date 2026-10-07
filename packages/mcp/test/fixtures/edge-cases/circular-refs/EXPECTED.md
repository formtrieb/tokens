# `circular-refs/` fixture — expected behavior

**Purpose:** verify the value-resolver detects a 2-token cycle (`{color.a}` → `{color.b}` → `{color.a}`).

## Shape

- 1 token set: `circular`
- 0 themes (`$themes.json` is `[]`)

## Loading expectations (no crash)

`buildTokenSystem(readTokenFiles(dir))` succeeds: `order` `["circular"]`, the set holds
`color.a` and `color.b`; no themes, no axes.

The loader layer is purely structural — it does NOT chase references. The cycle is discovered later, by `tokens-core`'s value-resolution.

## Expected value-resolution behavior

When `tokens-core` resolves `color.a` or `color.b`, it detects the cycle: the value stays
`{ kind: "unresolved" }` with its own text and the resolution carries the problem
`{ kind: "cycle", cycle: [...] }`. Nothing throws.

## Why this fixture exists

Regression guard: a refactor that accidentally turns the resolver into infinite-recursion-then-stack-overflow MUST fail this fixture's resolution test loudly.
