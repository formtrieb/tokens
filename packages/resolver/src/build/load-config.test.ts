import { describe, it, expect } from 'vitest';
import { findConfigFile } from './load-config.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('findConfigFile', () => {
  it('finds formtrieb-tokens.config.ts in the repo root', async () => {
    const repoRoot = join(__dirname, '..', '..');
    const found = await findConfigFile(repoRoot);
    expect(found).toMatch(/formtrieb-tokens\.config\.ts$/);
  });

  it('walks up parent directories to find the config', async () => {
    // Start from src/build, walk up — should find the repo-root config
    const found = await findConfigFile(__dirname);
    expect(found).toMatch(/formtrieb-tokens\.config\.ts$/);
  });

  it('returns null when no config exists in any ancestor', async () => {
    const found = await findConfigFile('/');
    expect(found).toBeNull();
  });
});
