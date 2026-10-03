import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPipeline } from './pipeline.js';
import config from '../formtrieb-tokens.config.js';

const tmpRoot = mkdtempSync(join(tmpdir(), 'formtrieb-pipeline-test-'));

describe('runPipeline output options', () => {
  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

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
