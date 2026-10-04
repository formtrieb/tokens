import { describe, it, expect } from 'vitest';
import { single } from '../../src/builders/single.js';
import type { BuilderConfig as Config, BuilderToken as Token } from '../../src/types.js';

const baseConfig: Config = { prefix: 'ds-' };

const tokens: Token[] = [
  { path: ['colors', 'semantic', 'brand'], value: '#fff', $type: 'color', raw: {} },
  { path: ['colors', 'semantic', 'danger'], value: '#f00', $type: 'color', raw: {} },
  { path: ['spacing', 'small'], value: '4px', $type: 'dimension', raw: {} },
];

describe('single', () => {
  it('emits one class per matching token', async () => {
    const builder = single({
      name: 'bg',
      source: 'colors.semantic.*',
      property: 'background-color',
    });
    const out = await builder({ tokens, config: baseConfig });
    expect(out.filename).toBe('bg.css');
    expect(out.content).toContain(
      '.ds-bg-brand { background-color: var(--ds-colors-semantic-brand); }'
    );
    expect(out.content).toContain(
      '.ds-bg-danger { background-color: var(--ds-colors-semantic-danger); }'
    );
    expect(out.content).not.toContain('spacing');
  });

  it('strips the glob prefix from class name leaves by default', async () => {
    const builder = single({
      name: 'bg',
      source: 'colors.semantic.*',
      property: 'background-color',
    });
    const out = await builder({ tokens, config: baseConfig });
    expect(out.content).toMatch(/\.ds-bg-brand\b/);
    expect(out.content).not.toMatch(/\.ds-bg-colors-semantic-brand\b/);
  });
});
