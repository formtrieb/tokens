# `empty/` fixture — expected behavior

**Purpose:** verify loading handles a fully empty token workspace without crashing.

## Shape

- `$metadata.json` → `{ "tokenSetOrder": [] }`
- `$themes.json` → `[]`
- No set files

## Loading expectations

`buildTokenSystem(readTokenFiles(dir))` succeeds: `order` `[]`, no sets, no themes, no
problems; no axes, defaults `{}`.

## Why this fixture exists

Smoke test for the trivial case. Several tools (`list_token_sets`, `list_themes`, `find_placeholders`) should return `[]` here without errors. Catches regressions where a downstream consumer assumes "at least one set" or "at least one theme".
