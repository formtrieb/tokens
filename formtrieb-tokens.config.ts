import { defineConfig } from '@formtrieb/token-resolver';
import { typography, directional, container } from '@formtrieb/token-resolver/builders';
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
  utilities: [
    typography(),
    directional({
      name: 'stack',
      source: 'spacing.stack.*',
      property: 'gap',
      sides: ['all'],
    }),
    directional({
      name: 'inset',
      source: 'spacing.inset.*',
      property: 'padding',
      sides: ['all'],
    }),
    container({
      name: 'content',
      rules: {
        'width': '100%',
        'max-width': '{content.max-width}',
        'margin-inline': 'auto',
        'padding-inline': '{layout.grid.margin}',
      },
    }),
  ],
});
