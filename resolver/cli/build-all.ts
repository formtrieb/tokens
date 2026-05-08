/**
 * Full pipeline orchestrator: runs every step in the correct order.
 *
 * Dependency graph:
 *
 *   build-tokens    ──┐
 *                     ├──▶  generate-css-imports  ──▶  bundle-css
 *   generate-utilities┘
 *                     │
 *                     └──▶  generate-token-map
 *
 *   - build-tokens writes        src/css/variables/*.css
 *   - generate-utilities writes  src/css/utilities/*.css
 *   - generate-css-imports reads BOTH (must run after them)
 *   - generate-token-map reads   src/css/variables/*.css (after build-tokens)
 *   - bundle-css reads main.css  (after generate-css-imports)
 */

import { processAllThemes } from '../build/theme-processor.js';
import { generateAllUtilities } from '../generators/utilities.js';
import { generateCssImports } from '../generators/css-imports.js';
import { generateTokenMap } from '../generators/token-map.js';
import { bundleCss } from '../generators/bundle-css.js';

// TODO(you): wire up the pipeline.
//
// Decisions to make — these shape the developer experience of `npm run build`:
//
//   1. SEQUENCING — build-tokens and generate-utilities are independent.
//      Run them sequentially (simple, predictable logs) or in parallel via
//      `Promise.all` (faster, interleaved logs)?
//
//   2. ERROR HANDLING — if one step throws (e.g. a broken token reference),
//      should the whole pipeline halt, or continue with the remaining
//      independent steps and surface a summary at the end?
//
//   3. TIMING — print per-step timings? They're nice in CI logs but add noise
//      locally. Use `console.time`/`console.timeEnd` if you want them.
//
// Recommended starting point (sequential, fail-fast, no timing):
//
//     await processAllThemes();
//     await generateAllUtilities();
//     await generateCssImports();        // reads variables/ + utilities/
//     await generateTokenMap();          // reads variables/
//     bundleCss();                       // reads main.css
//
// Replace the line below with your orchestration:

throw new Error('build-all not implemented yet — see TODO above');
