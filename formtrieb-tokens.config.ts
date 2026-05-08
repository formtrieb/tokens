import { defineConfig } from './src/define-config.js';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  prefix: 'ds-',
  paths: {
    tokens: join(__dirname, 'tokens'),
    output: join(__dirname, 'cssOutput', 'css'),
    tokenMap: join(__dirname, 'cssOutput', 'tokens', 'token-map.json'),
  },
  output: { bundle: true },
  privateTokenPrefixes: ['*'],
  themeGroups: {
    Foundation: { useReferences: false },
  },
  defaultGroupBehavior: { useReferences: true },
  utilities: [], // populated in Phase 10 — for now we still use the hardcoded utility generators
});
