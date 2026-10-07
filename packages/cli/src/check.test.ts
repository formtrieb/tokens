import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { formatCheck, runCheck, UsageError } from './check.js';
import type { Config } from './types.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url));
const MCP_RULES = fileURLToPath(new URL('../../mcp/test/fixtures/tokens.rules.json', import.meta.url));

let root: string;
const write = (rel: string, data: unknown) => {
  const file = join(root, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};

/** A system with two modes, a cycle in Dark and an untyped token. */
function system(): Config {
  write('tokens/$metadata.json', { tokenSetOrder: ['base', 'light', 'dark'] });
  write('tokens/$themes.json', [
    { id: 'l', name: 'Light', group: 'Mode', selectedTokenSets: { base: 'source', light: 'enabled' } },
    { id: 'd', name: 'Dark', group: 'Mode', selectedTokenSets: { base: 'source', dark: 'enabled' } },
  ]);
  write('tokens/base.json', { size: { $type: 'dimension', s: { $value: '4px' } }, note: { $value: 'x' } });
  write('tokens/light.json', { ink: { $type: 'color', $value: '#000' } });
  write('tokens/dark.json', { ink: { $type: 'color', $value: '{ink2}' }, ink2: { $type: 'color', $value: '{ink}' } });
  return { prefix: 'x-', paths: { tokens: join(root, 'tokens'), output: join(root, 'out'), tokenMap: join(root, 'map.json') } };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cli-check-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('runCheck', () => {
  it('reports resolution problems per theme and fails on an error', async () => {
    const result = await runCheck(system());
    expect(result.rules).toBe('none');
    expect(result.resolution.themes).toEqual(['Mode/Light', 'Mode/Dark']);
    expect(result.resolution.problems.map((p) => `${p.theme} ${p.severity} ${p.kind}`)).toEqual([
      'Mode/Light warning untyped-token',
      'Mode/Dark warning untyped-token',
      'Mode/Dark error cycle',
    ]);
    expect(result.summary).toMatchObject({ errors: 1, warnings: 2, resolution: 3 });
    expect(result.passed).toBe(false);
    expect(result.parity).toEqual({ axis: 'Mode', base: 'Light', against: { Dark: { identical: false, missingInBase: ['ink2'] } } });
  });

  it('has the JSON form of the MCP tool, plus passed and threshold', async () => {
    const result = await runCheck(system());
    expect(Object.keys(result)).toEqual(['rules', 'summary', 'byRule', 'brokenReferences', 'parity', 'resolution', 'passed', 'threshold']);
  });

  it('reads rules from --rules, and from tokens.rules.json next to the token folder', async () => {
    const config = system();
    write('tokens.rules.json', { rules: [{ rule: 'flat', kind: 'depth', max: 1, severity: 'warning' }] });
    const near = await runCheck(config);
    expect(near.rules).toBe(join(realpathSync(root), 'tokens.rules.json'));
    expect(near.byRule.flat).toMatchObject({ count: 1, severity: 'warning' });
    const given = await runCheck(config, { rules: MCP_RULES });
    expect(given.rules).toBe(MCP_RULES);
  });

  it('moves the threshold with severity', async () => {
    const config = system();
    write('tokens/dark.json', { ink: { $type: 'color', $value: '#fff' } });
    expect((await runCheck(config)).passed).toBe(true);
    expect((await runCheck(config, { severity: 'warning' })).passed).toBe(false);
  });

  it('refuses an unknown axis and a malformed rules file as usage errors', async () => {
    const config = system();
    await expect(runCheck(config, { axis: 'Nope' })).rejects.toBeInstanceOf(UsageError);
    write('bad.json', { rules: [{ rule: 'x', kind: 'depth' }] });
    await expect(runCheck(config, { rules: join(root, 'bad.json') })).rejects.toThrow(/rules\[0\]\.max/);
  });

  it('writes text that names each finding and the verdict', async () => {
    const text = formatCheck(await runCheck(system()));
    expect(text).toContain('✗ cycle');
    expect(text).toContain('Mode/Dark   ink → ink2 → ink');
    expect(text).toContain('Parity (axis Mode): Light vs Dark: 1 only in Dark');
    expect(text).toMatch(/✗ 1 error, 2 warnings — failed at threshold "error"$/);
  });
});

describe('formtrieb-tokens check (exit codes)', () => {
  const cli = async (...args: string[]) => {
    try {
      const { stdout } = await run('npx', ['tsx', CLI, 'check', '--config', join(root, 'formtrieb-tokens.config.mjs'), ...args], { cwd: root });
      return { code: 0, stdout };
    } catch (e) {
      const err = e as { code: number; stdout: string };
      return { code: err.code, stdout: err.stdout };
    }
  };
  const config = () => {
    const c = system();
    write('formtrieb-tokens.config.mjs', `export default ${JSON.stringify(c)};`);
  };

  it('exits 1 on a finding, 2 on a usage error, and prints JSON only on stdout', async () => {
    config();
    const failed = await cli('--json');
    expect(failed.code).toBe(1);
    expect(JSON.parse(failed.stdout).passed).toBe(false);
    expect((await cli('--severity', 'fatal')).code).toBe(2);
    expect((await cli('--axis', 'Nope')).code).toBe(2);
  }, 60_000);
});
