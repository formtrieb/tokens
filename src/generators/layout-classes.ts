/**
 * Layout utility class generator.
 *
 * Currently emits a single `.{prefix}content` class — a centered max-width content
 * container that uses device-aware padding and max-width tokens.
 */

import { config } from '../config.js';

const { prefix } = config;

const HEADER = `/**
 * Layout utility classes — auto-generated.
 * Values are device-aware: they change automatically per data-device attribute.
 *
 * Usage: <main class="${prefix}content">…</main>
 */\n\n`;

export function generateLayoutClasses(): string {
	const rule = `.${prefix}content {
  width: 100%;
  max-width: var(--${prefix}content-max-width);
  margin-inline: auto;
  padding-inline: var(--${prefix}layout-grid-margin);
}`;

	return HEADER + rule + '\n';
}
