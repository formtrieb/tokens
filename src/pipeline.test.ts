import { describe, it, expect } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { runPipeline } from './pipeline.js';
import config from '../formtrieb-tokens.config.js';

describe('runPipeline output options', () => {
  it('does NOT generate bundle.css when output.bundle is false', async () => {
    const bundlePath = `${config.paths.output}/bundle.css`;
    if (existsSync(bundlePath)) rmSync(bundlePath);

    await runPipeline({ ...config, output: { bundle: false } });

    expect(existsSync(bundlePath)).toBe(false);
  });
});
