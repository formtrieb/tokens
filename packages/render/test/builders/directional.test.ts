import { describe, it, expect } from 'vitest';
import { directional } from '../../src/builders/directional.js';
import type { BuilderConfig as Config, BuilderToken as Token } from '../../src/types.js';

const cfg: Config = { prefix: 'ds-' };
const tokens: Token[] = [
  { path: ['spacing', 'component', 'md'], value: '16px', $type: 'dimension', raw: {} },
];

describe('directional', () => {
  it('emits "all" side without suffix using the bare CSS property', async () => {
    const out = await directional({
      name: 'p',
      source: 'spacing.component.*',
      property: 'padding',
      sides: ['all'],
    })({ tokens, config: cfg });
    expect(out.content).toContain('.ds-p-md { padding: var(--ds-spacing-component-md); }');
  });

  it('maps sides to logical CSS properties for padding', async () => {
    const out = await directional({
      name: 'p',
      source: 'spacing.component.*',
      property: 'padding',
      sides: ['t', 'b', 's', 'e', 'x', 'y'],
    })({ tokens, config: cfg });
    expect(out.content).toContain('.ds-p-t-md { padding-block-start: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-p-b-md { padding-block-end: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-p-s-md { padding-inline-start: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-p-e-md { padding-inline-end: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-p-x-md { padding-inline: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-p-y-md { padding-block: var(--ds-spacing-component-md); }');
  });

  it('maps sides to logical CSS properties for border', async () => {
    const out = await directional({
      name: 'divider',
      source: 'spacing.component.*',
      property: 'border',
      sides: ['t', 's', 'e'],
    })({ tokens, config: cfg });
    expect(out.content).toContain('.ds-divider-t-md { border-block-start: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-divider-s-md { border-inline-start: var(--ds-spacing-component-md); }');
    expect(out.content).toContain('.ds-divider-e-md { border-inline-end: var(--ds-spacing-component-md); }');
  });

  it('uses output filename {name}.css', async () => {
    const out = await directional({ name: 'p', source: 'spacing.component.*', property: 'padding', sides: ['all'] })(
      { tokens, config: cfg }
    );
    expect(out.filename).toBe('p.css');
  });
});
