import { describe, it, expect } from 'vitest';
import { loadAllTokens } from './load-tokens.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TOKENS_DIR = join(__dirname, '..', '..', 'tests', 'fixtures', 'tokens');

describe('loadAllTokens', () => {
  it('loads tokens from all JSON files in the tokens directory', async () => {
    const tokens = await loadAllTokens(TOKENS_DIR);
    expect(tokens.length).toBeGreaterThan(100);
    // typography tokens exist (verifies $type-driven discovery on a full system)
    expect(tokens.some(t => t.$type === 'typography')).toBe(true);
  });
});
