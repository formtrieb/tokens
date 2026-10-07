#!/usr/bin/env node
import type { Severity } from '@formtrieb/tokens-core';
import { findConfigFile, loadConfig } from './build/load-config.js';
import { runPipeline } from './pipeline.js';

const USAGE = `Usage:
  formtrieb-tokens [--watch] [--config <path>]
      build the CSS, utilities, main.css, bundle and token map
  formtrieb-tokens check [--config <path>] [--rules <file>] [--axis <name>]
                         [--severity error|warning|info] [--json]
      check the tokens: resolution, design rules, references, parity; writes nothing
      exit 0 passed, 1 a finding at or above --severity (default error), 2 a usage error`;

interface Args {
  command: 'build' | 'check';
  config?: string;
  watch: boolean;
  rules?: string;
  axis?: string;
  severity?: Severity;
  json: boolean;
}

class UsageProblem extends Error {}

function parseArgs(argv: string[]): Args {
  const rest = argv.slice(2);
  const args: Args = { command: 'build', watch: false, json: false };
  if (rest[0] === 'check') {
    args.command = 'check';
    rest.shift();
  }
  const value = (i: number, name: string) => {
    const v = rest[i];
    if (v === undefined || v.startsWith('-')) throw new UsageProblem(`${name} needs a value.`);
    return v;
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--help' || a === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (a === '--config' || a === '-c') {
      args.config = value(++i, a);
    } else if (args.command === 'build' && (a === '--watch' || a === '-w')) {
      args.watch = true;
    } else if (args.command === 'check' && a === '--rules') {
      args.rules = value(++i, a);
    } else if (args.command === 'check' && a === '--axis') {
      args.axis = value(++i, a);
    } else if (args.command === 'check' && a === '--severity') {
      const v = value(++i, a);
      if (v !== 'error' && v !== 'warning' && v !== 'info') throw new UsageProblem('--severity must be error, warning or info.');
      args.severity = v;
    } else if (args.command === 'check' && a === '--json') {
      args.json = true;
    } else {
      throw new UsageProblem(`Unknown argument: ${a}`);
    }
  }
  return args;
}

async function main() {
  let args: Args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${USAGE}`);
    process.exit(2);
  }
  // With --json, stdout carries only the report.
  const say = args.json ? (m: string) => console.error(m) : (m: string) => console.log(m);

  const configPath = args.config ?? (await findConfigFile(process.cwd()));
  if (!configPath) {
    console.error('No formtrieb-tokens.config.{ts,mjs,js} found in cwd or any parent directory.');
    process.exit(args.command === 'check' ? 2 : 1);
  }
  const config = await loadConfig(configPath);
  say(`✓ Config loaded: ${configPath}`);

  if (args.command === 'check') {
    const { runCheck, formatCheck, UsageError } = await import('./check.js');
    try {
      const result = await runCheck(config, { rules: args.rules, axis: args.axis, severity: args.severity });
      console.log(args.json ? JSON.stringify(result, null, 2) : formatCheck(result));
      process.exit(result.passed ? 0 : 1);
    } catch (e) {
      if (e instanceof UsageError) {
        console.error(e.message);
        process.exit(2);
      }
      throw e;
    }
  } else if (args.watch) {
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
