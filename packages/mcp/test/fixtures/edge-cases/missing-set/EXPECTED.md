# `missing-set/` fixture — expected behavior

**Purpose:** verify that a `$metadata.json` `tokenSetOrder` entry pointing to a set with no on-disk file is reported when loading, without stopping the tokens that do exist.

## Shape

- `$metadata.json` lists 2 sets: `Real`, `Ghost`
- Only `Real.json` exists on disk
- `$themes.json` references both `Real` and `Ghost` as `enabled`

## Loading expectations (reported, not silent)

`buildTokenSystem(readTokenFiles(dir))` → `order` `["Real"]`, one set, and the problem
`{ kind: "missing-set", set: "Ghost" }`. `list_token_sets` returns it under `problems`.

## Selection expectations (theme references missing set)

`selectionFor(system, { Theme: "Default" })` → `[{ Real: enabled }, { Ghost: enabled }]`:
the theme keeps `Ghost`. Composing that selection reports `missing-set` again; the tokens
of `Real` resolve as usual.
