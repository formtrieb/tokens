import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareTrees, diffLines, type AllowRule } from '../src/css-diff.js';

const ALLOW: AllowRule[] = JSON.parse(
  readFileSync(new URL('../css-allowlist.json', import.meta.url), 'utf-8')
);

const css = (...lines: string[]) => [':root {', ...lines, '}', ''].join('\n');

describe('diffLines', () => {
  it('finds nothing in equal input', () => {
    expect(diffLines(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('reports a changed line with its 1-based position', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([
      { at: 2, sd: ['b'], render: ['B'] },
    ]);
  });

  it('separates hunks around common lines, including inserts and deletes', () => {
    expect(diffLines(['a', 'x', 'b', 'c', 'y'], ['a', 'b', 'n', 'c'])).toEqual([
      { at: 2, sd: ['x'], render: [] },
      { at: 4, sd: [], render: ['n'] },
      { at: 5, sd: ['y'], render: [] },
    ]);
  });
});

describe('compareTrees', () => {
  it('sorts files and tells identical, missing and extra apart', () => {
    const sd = new Map([
      ['b.css', 'x'],
      ['a.css', 'y'],
    ]);
    const render = new Map([
      ['a.css', 'y'],
      ['c.css', 'z'],
    ]);
    const verdicts = compareTrees(sd, render, [], (f) => (f === 'b.css' ? 'boom' : undefined));
    expect(verdicts).toEqual([
      { file: 'a.css', status: 'identical' },
      { file: 'b.css', status: 'missing', error: 'boom' },
      { file: 'c.css', status: 'extra' },
    ]);
  });

  it('allows the FOR-496 calc() rewrite and nothing next to it', () => {
    const sd = css('  --ds-content-max-width: var(--ds-breakpoints-desktop)-1px;');
    const fixed = css('  --ds-content-max-width: calc(var(--ds-breakpoints-desktop) - 1px);');
    const [ok] = compareTrees(new Map([['variables/device.css', sd]]), new Map([['variables/device.css', fixed]]), ALLOW);
    expect(ok.status).toBe('allowed');
    expect(ok.hunks?.[0].allowed).toBe('FOR-496');

    const wrong = css('  --ds-content-max-width: 75rem;');
    const [bad] = compareTrees(new Map([['variables/device.css', sd]]), new Map([['variables/device.css', wrong]]), ALLOW);
    expect(bad.status).toBe('diff');
  });

  it('allows the FOR-497 line to vanish, but only that line', () => {
    const sd = css('  --ds-easing-x: cubic-bezier([object Object], [object Object]);', '  --ds-a: 1px;');
    const dropped = css('  --ds-a: 1px;');
    const [ok] = compareTrees(new Map([['bundle.css', sd]]), new Map([['bundle.css', dropped]]), ALLOW);
    expect(ok.status).toBe('allowed');

    const alsoChanged = css('  --ds-a: 2px;');
    const [bad] = compareTrees(new Map([['bundle.css', sd]]), new Map([['bundle.css', alsoChanged]]), ALLOW);
    expect(bad.status).toBe('diff');
  });

  it('does not apply the allowlist outside the files it names', () => {
    const sd = 'max: var(--a)-1px;\n';
    const fixed = 'max: calc(var(--a) - 1px);\n';
    const [v] = compareTrees(new Map([['token-map.json', sd]]), new Map([['token-map.json', fixed]]), ALLOW);
    expect(v.status).toBe('diff');
  });
});
