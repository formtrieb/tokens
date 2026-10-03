#!/usr/bin/env node
import { findConfigFile, loadConfig } from './build/load-config.js';
import { runPipeline } from './pipeline.js';

interface Args {
  config?: string;
  watch: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { watch: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--watch' || a === '-w') {
      args.watch = true;
    } else if (a === '--config' || a === '-c') {
      args.config = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: formtrieb-tokens [--watch] [--config <path>]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config ?? (await findConfigFile(process.cwd()));
  if (!configPath) {
    console.error(
      'No formtrieb-tokens.config.{ts,mjs,js} found in cwd or any parent directory.'
    );
    process.exit(1);
  }
  const config = await loadConfig(configPath);
  console.log(`✓ Config loaded: ${configPath}`);

  if (args.watch) {
    const { startWatcher } = await import('./watch.js');
    await startWatcher(config);
  } else {
    await runPipeline(config);
    console.log('✓ Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
