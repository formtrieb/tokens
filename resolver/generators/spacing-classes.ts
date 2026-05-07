/**
 * Spacing utility class generator.
 *
 * Emits two class families per step:
 *   - `.{prefix}stack-{step}` — flex column container with a gap
 *   - `.{prefix}inset-{step}` — padding container
 *
 * Underlying spacing values are device-aware CSS variables, so the rendered
 * spacing changes automatically with a `data-device` attribute on a parent.
 */

import { config } from '../config.js';

const { prefix } = config;

const SPACING_STEPS = ['1x', '2x', '3x', '4x', '5x', '6x', '7x', '8x', 'none'];

const HEADER = `/**
 * Spacing utility classes — auto-generated.
 * Values are device-aware: they change automatically per data-device attribute.
 *
 * Stack  — vertical gap between children (use on flex/grid containers)
 * Inset  — padding (use on content containers)
 *
 * Usage: <div class="${prefix}stack-3x" style="display: flex; flex-direction: column;">…</div>
 *        <section class="${prefix}inset-4x">…</section>
 */\n\n`;

export function generateSpacingClasses(): string {
	const rules: string[] = [];

	for (const step of SPACING_STEPS) {
		rules.push(`.${prefix}stack-${step} {
  display: flex;
  flex-direction: column;
  gap: var(--${prefix}spacing-stack-${step});
}`);
	}

	for (const step of SPACING_STEPS) {
		rules.push(`.${prefix}inset-${step} {
  padding: var(--${prefix}spacing-inset-${step});
}`);
	}

	return HEADER + rules.join('\n\n') + '\n';
}
