import { describe, it, expect, afterAll, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPipeline } from './pipeline.js';
import config from '../formtrieb-tokens.config.js';

const tmpRoot = mkdtempSync(join(tmpdir(), 'formtrieb-pipeline-test-'));

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runPipeline output options', () => {
  it('does NOT generate bundle.css when output.bundle is false', async () => {
    const tmpOutput = join(tmpRoot, 'css');
    const tmpTokenMap = join(tmpRoot, 'tokens', 'token-map.json');

    await runPipeline({
      ...config,
      paths: { ...config.paths, output: tmpOutput, tokenMap: tmpTokenMap },
      output: { bundle: false },
    });

    expect(existsSync(join(tmpOutput, 'bundle.css'))).toBe(false);
    // Sanity: the rest of the pipeline still ran
    expect(existsSync(join(tmpOutput, 'main.css'))).toBe(true);
  });
});

describe('runPipeline leftover files', () => {
  it('names .css files in variables/ and utilities/ that this run did not render, and keeps them', async () => {
    const tmpOutput = join(tmpRoot, 'leftovers');
    mkdirSync(join(tmpOutput, 'variables'), { recursive: true });
    mkdirSync(join(tmpOutput, 'utilities'), { recursive: true });
    writeFileSync(join(tmpOutput, 'variables', 'components-divider.css'), ':root { --x: 1; }\n');
    writeFileSync(join(tmpOutput, 'utilities', 'old-builder.css'), '.x { }\n');
    writeFileSync(join(tmpOutput, 'variables', 'notes.txt'), 'not css\n');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runPipeline({
      ...config,
      paths: { ...config.paths, output: tmpOutput, tokenMap: join(tmpRoot, 'leftovers-map.json') },
      utilities: [],
    });

    const message = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    warn.mockRestore();
    expect(message).toContain('variables/components-divider.css');
    expect(message).toContain('utilities/old-builder.css');
    expect(message).not.toContain('notes.txt');
    expect(existsSync(join(tmpOutput, 'variables', 'components-divider.css'))).toBe(true);
    expect(readFileSync(join(tmpOutput, 'main.css'), 'utf-8')).not.toContain('components-divider');
  });

  it('stays quiet when the output folder holds only what was rendered', async () => {
    const tmpOutput = join(tmpRoot, 'clean');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runPipeline({
      ...config,
      paths: { ...config.paths, output: tmpOutput, tokenMap: join(tmpRoot, 'clean-map.json') },
    });

    const calls = warn.mock.calls.length;
    warn.mockRestore();
    expect(calls).toBe(0);
  });
});

describe('runPipeline render file options', () => {
  const dir = join(tmpRoot, 'render-file');
  const tokens = join(dir, 'tokens');
  mkdirSync(tokens, { recursive: true });
  writeFileSync(join(tokens, '$metadata.json'), JSON.stringify({ tokenSetOrder: ['Base'] }));
  writeFileSync(
    join(tokens, '$themes.json'),
    JSON.stringify([{ id: 'base', name: 'Base', group: 'Base', selectedTokenSets: { Base: 'enabled' } }])
  );
  writeFileSync(
    join(tokens, 'Base.json'),
    JSON.stringify({
      space: { s: { $value: '8px', $type: 'dimension' } },
      brand: { $value: '#336699', $type: 'color' },
    })
  );
  const rules = [{ theme: 'Base/Base', selector: ':root', references: false, file: 'variables/base.css' }];
  const renderFile = join(dir, 'render.json');
  writeFileSync(join(dir, 'missing-options.json'), JSON.stringify({ rules }));
  const canonicalFile = join(dir, 'render-canonical.json');
  writeFileSync(renderFile, JSON.stringify({ options: { units: 'source', color: 'source' }, rules }));
  writeFileSync(canonicalFile, JSON.stringify({ options: { dialect: 'canonical' }, rules }));

  async function run(name: string, extra: Partial<typeof config> = {}, render = renderFile) {
    const output = join(dir, name);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await runPipeline({
      prefix: 'x-',
      paths: { tokens, output, tokenMap: join(dir, `${name}-map.json`) },
      render,
      ...extra,
    });
    const warnings = warn.mock.calls.map((c) => c.join(' '));
    warn.mockRestore();
    return { css: readFileSync(join(output, 'variables', 'base.css'), 'utf-8'), warnings };
  }

  it('renders with the options the render file names', async () => {
    const { css, warnings } = await run('from-file');
    expect(css).toContain('--x-space-s: 8px;');
    expect(css).toContain('--x-brand: #336699;');
    expect(warnings).toEqual([]);
  });

  it('defaults to the Tokens-Studio policy where neither config nor file says', async () => {
    const { css } = await run('defaults', {}, join(dir, 'missing-options.json'));
    expect(css).toContain('--x-space-s: 0.5rem;');
    expect(css).toContain('--x-brand: rgb(51, 102, 153);');
  });

  it('lets the config override the file, with one warning per option', async () => {
    const { css, warnings } = await run('overridden', { units: 'tokens-studio', color: 'rgb' });
    expect(css).toContain('--x-space-s: 0.5rem;');
    expect(css).toContain('--x-brand: rgb(51, 102, 153);');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('units "source"');
    expect(warnings[0]).toContain('"tokens-studio"');
  });

  it('stays quiet when the config agrees with the file', async () => {
    const { warnings } = await run('agreeing', { units: 'source' });
    expect(warnings).toEqual([]);
  });

  it('keeps an old canonical render file as written, with one warning that dialect has no effect', async () => {
    const { css, warnings } = await run('canonical', {}, canonicalFile);
    expect(css).toContain('--x-space-s: 8px;');
    expect(css).toContain('--x-brand: #336699;');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"dialect" has no effect');
  });
});
