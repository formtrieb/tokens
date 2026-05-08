import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { runPipeline } from './pipeline.js';
import config from '../formtrieb-tokens.config.js';

describe('runPipeline output options', () => {
  // After deleting bundle.css and running with bundle: false, restore the
  // file so the e2e snapshot test (a separate fork that reads cssOutput/
  // from disk) doesn't see a missing file.
  afterAll(async () => {
    await runPipeline(config);
  });

  it('does NOT generate bundle.css when output.bundle is false', async () => {
    const bundlePath = `${config.paths.output}/bundle.css`;
    if (existsSync(bundlePath)) rmSync(bundlePath);

    await runPipeline({ ...config, output: { bundle: false } });

    expect(existsSync(bundlePath)).toBe(false);
  });
});
