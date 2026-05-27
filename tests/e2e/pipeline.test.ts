import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');

beforeAll(async () => {
  await execAsync('npm run build', { cwd: ROOT });
}, 60_000);

function readDirRecursive(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const rel = full.slice(ROOT.length + 1);
    if (statSync(full).isDirectory()) {
      Object.assign(result, readDirRecursive(full));
    } else if (entry.endsWith('.css') || entry.endsWith('.json')) {
      result[rel] = readFileSync(full, 'utf-8');
    }
  }
  return result;
}

describe('pipeline E2E', () => {
  it('produces stable CSS output', () => {
    const files = readDirRecursive(join(ROOT, 'cssOutput', 'css'));
    expect(files).toMatchSnapshot();
  });

  it('produces stable token-map output', () => {
    const tokenMap = readFileSync(
      join(ROOT, 'cssOutput', 'tokens', 'token-map.json'),
      'utf-8'
    );
    expect(JSON.parse(tokenMap)).toMatchSnapshot();
  });
});
