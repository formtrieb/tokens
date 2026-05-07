/**
 * Generate a JSON lookup map from Figma token paths to CSS variable names.
 *
 * Parses all generated CSS variable files and builds a bidirectional map:
 *   - figmaToCSS: "color/controls/brand/background/enabled" → "--ds-color-controls-brand-background-idle"
 *   - cssToFigma: "--ds-color-controls-brand-background-idle" → "color/controls/brand/background/enabled"
 *
 * Used by tooling (Figma-to-code skills, audits) to look up the CSS variable
 * for a Figma token path without re-parsing the token JSON.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from '../config.js';

const { buildPath, prefix, tokenMapPath } = config;

interface TokenMap {
  prefix: string;
  count: number;
  figmaToCSS: Record<string, string>;
  cssToFigma: Record<string, string>;
}

export async function generateTokenMap(): Promise<void> {
  const figmaToCSS: Record<string, string> = {};
  const cssToFigma: Record<string, string> = {};

  const files = await readdir(buildPath);
  const cssFiles = files.filter((f) => f.endsWith('.css'));

  for (const file of cssFiles) {
    const content = await readFile(join(buildPath, file), 'utf-8');

    const varRegex = /--([a-z0-9-]+)\s*:/g;
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(content)) !== null) {
      const cssVarName = `--${match[1]}`;

      if (!cssVarName.startsWith(`--${prefix}`)) continue;

      const withoutPrefix = match[1].slice(prefix.length);
      const figmaPath = withoutPrefix.replace(/-/g, '/');

      figmaToCSS[figmaPath] = cssVarName;
      cssToFigma[cssVarName] = figmaPath;
    }
  }

  const tokenMap: TokenMap = {
    prefix: `--${prefix}`,
    count: Object.keys(figmaToCSS).length,
    figmaToCSS,
    cssToFigma,
  };

  await mkdir(dirname(tokenMapPath), { recursive: true });
  await writeFile(tokenMapPath, JSON.stringify(tokenMap, null, 2), 'utf-8');

  console.log(
    `✅ Token map generated: ${tokenMap.count} tokens → token-map.json`,
  );

  const collections = new Set(
    Object.keys(figmaToCSS).map((p) => p.split('/')[0]),
  );
  console.log(`   Collections: ${[...collections].join(', ')}`);
}
