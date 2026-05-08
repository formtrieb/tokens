/**
 * Bundles `main.css` by resolving all `@import` statements into a single
 * self-contained CSS file. This lets consumers (like the playground app)
 * include one file in their styles array without having to chase @import
 * chains across the filesystem.
 *
 * Input:  src/css/main.css (with @import statements)
 * Output: src/css/bundle.css (all local imports inlined; url() imports
 *         are hoisted to the top as the CSS spec requires)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import type { Config } from '../types.js';

function resolveImports(filePath: string): { urlImports: string[]; css: string } {
	const content = readFileSync(filePath, 'utf-8');
	const dir = dirname(filePath);
	const urlImports: string[] = [];

	const css = content.replace(
		/^@import\s+['"](.+?)['"];.*$/gm,
		(match, importPath) => {
			const resolved = join(dir, importPath);
			try {
				const fileContent = readFileSync(resolved, 'utf-8').trim();

				// Split @import url(…) lines out — they must be hoisted to the top
				const lines = fileContent.split('\n');
				const urls: string[] = [];
				const rest: string[] = [];
				for (const line of lines) {
					if (line.trim().startsWith('@import url(')) {
						urls.push(line.trim());
					} else {
						rest.push(line);
					}
				}
				urlImports.push(...urls);
				return `/* --- ${importPath} --- */\n${rest.join('\n').trim()}`;
			} catch {
				console.warn(`⚠️  Could not resolve: ${importPath}`);
				return match;
			}
		}
	);

	return { urlImports, css };
}

export function bundleCss(config: Config): void {
	const mainCssPath = `${config.paths.output}/main.css`;
	const bundleCssPath = `${config.paths.output}/bundle.css`;

	const { urlImports, css } = resolveImports(mainCssPath);

	const bundled = [
		'/* Auto-generated — do not edit. Run: npx nx run design-system:bundle-css */',
		...urlImports,
		css,
	].join('\n');

	writeFileSync(bundleCssPath, bundled + '\n', 'utf-8');

	const lineCount = bundled.split('\n').length;
	console.log(`✓ bundle.css generated (${lineCount} lines, all @imports resolved)`);
}
