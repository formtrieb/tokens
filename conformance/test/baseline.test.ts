/**
 * The instrument reads the current state against the pinned one. A finding
 * that appears or disappears fails this test; `pnpm conformance
 * --update-baseline` pins a new state deliberately.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASELINE,
  DEFAULT_TOKENS,
  diffAgainstBaseline,
  runConformance,
  type Result,
} from '../src/run.js';

describe('conformance baseline', () => {
  it('matches conformance/baseline.json', async () => {
    const baseline: Result = JSON.parse(readFileSync(DEFAULT_BASELINE, 'utf-8'));
    const current = await runConformance(DEFAULT_TOKENS);
    const { appeared, disappeared, countsChanged } = diffAgainstBaseline(current, baseline);
    expect(appeared, 'findings that are new since the baseline').toEqual([]);
    expect(disappeared, 'findings that vanished since the baseline — pin deliberately').toEqual([]);
    expect(countsChanged, 'per-theme or total counts moved').toBe(false);
  });
});
