import { describe, it, expect } from 'vitest';
import { container } from '../../src/builders/container.js';
import type { BuilderConfig as Config } from '../../src/types.js';

const cfg: Config = { prefix: 'ds-' };

describe('container', () => {
  it('resolves {token.path} references to var(--prefix-token-path)', async () => {
    const out = await container({
      name: 'content',
      rules: { 'max-width': '{content.max-width}' },
    })({ tokens: [], config: cfg });
    expect(out.content).toContain('.ds-content {');
    expect(out.content).toContain('max-width: var(--ds-content-max-width);');
  });

  it('emits literals as-is', async () => {
    const out = await container({
      name: 'content',
      rules: { 'margin-inline': 'auto', 'max-width': '{content.max-width}' },
    })({ tokens: [], config: cfg });
    expect(out.content).toContain('margin-inline: auto;');
    expect(out.content).toContain('max-width: var(--ds-content-max-width);');
  });

  it('produces {name}.css filename', async () => {
    const out = await container({
      name: 'content',
      rules: { 'max-width': '{x.y}' },
    })({ tokens: [], config: cfg });
    expect(out.filename).toBe('content.css');
  });
});
