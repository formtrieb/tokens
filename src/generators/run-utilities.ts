import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAllTokens } from '../shared/load-tokens.js';
import type { Config } from '../types.js';

export async function runUtilities(config: Config): Promise<void> {
  const utilities = config.utilities ?? [];
  if (utilities.length === 0) return;

  const tokens = await loadAllTokens(config.paths.tokens);
  const utilitiesDir = join(config.paths.output, 'utilities');
  await mkdir(utilitiesDir, { recursive: true });

  const seen = new Set<string>();
  for (const builder of utilities) {
    const out = await builder({ tokens, config });
    if (seen.has(out.filename)) {
      throw new Error(
        `Duplicate utility filename: ${out.filename} — two builders produced the same file. Rename one.`
      );
    }
    seen.add(out.filename);
    await writeFile(join(utilitiesDir, out.filename), out.content, 'utf-8');
    console.log(`✓ ${out.filename}`);
  }
}
