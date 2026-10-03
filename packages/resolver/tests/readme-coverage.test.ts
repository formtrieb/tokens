import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Top-level interfaces whose property names must each appear at least once
 * in README.md. Add a new entry here when introducing a user-facing config
 * interface — that addition is a deliberate "this is a documented surface"
 * signal, not auto-discovery.
 */
const INTERFACES_TO_CHECK = ['Config', 'TypographyConfig', 'ConfigOutput'] as const;

function extractInterfaceBody(source: string, name: string): string {
  const declRe = new RegExp(`export interface ${name}\\s*\\{`);
  const match = declRe.exec(source);
  if (!match) throw new Error(`Interface ${name} not found in src/types.ts`);
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

function topLevelPropertyNames(body: string): string[] {
  const names: string[] = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    if (depth === 0) {
      const m = line.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\??:/);
      if (m) names.push(m[1]);
    }
    for (const c of line) {
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
  }
  return names;
}

describe('README coverage', () => {
  it('mentions every top-level property of documented Config interfaces', () => {
    const types = readFileSync(join(repoRoot, 'src/types.ts'), 'utf-8');
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf-8');

    const missing: string[] = [];
    for (const iface of INTERFACES_TO_CHECK) {
      const body = extractInterfaceBody(types, iface);
      for (const key of topLevelPropertyNames(body)) {
        const wordRe = new RegExp(`\\b${key}\\b`);
        if (!wordRe.test(readme)) missing.push(`${iface}.${key}`);
      }
    }

    expect(
      missing,
      `README.md must document every property of: ${INTERFACES_TO_CHECK.join(
        ', '
      )}. Missing keys:\n  ${missing.join('\n  ')}`
    ).toEqual([]);
  });
});
