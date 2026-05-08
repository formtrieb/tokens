/**
 * Layout utility class generator.
 *
 * Currently emits a single `.{prefix}content` class — a centered max-width content
 * container that uses device-aware padding and max-width tokens.
 */

import type { Config } from '../types.js';

export function generateLayoutClasses(config: Config): string {
	const prefix = config.prefix;

	const header = `/**
 * Layout utility classes — auto-generated.
 * Values are device-aware: they change automatically per data-device attribute.
 *
 * Usage: <main class="${prefix}content">…</main>
 */\n\n`;

	const rule = `.${prefix}content {
  width: 100%;
  max-width: var(--${prefix}content-max-width);
  margin-inline: auto;
  padding-inline: var(--${prefix}layout-grid-margin);
}`;

	return header + rule + '\n';
}
