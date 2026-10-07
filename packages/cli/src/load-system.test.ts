import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTokenSystem } from './load-system.js';

let root: string;
function write(rel: string, data: unknown) {
  const file = join(root, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resolver-load-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('loadTokenSystem', () => {
  it('reads only the sets $metadata.json and $themes.json name, nothing outside the folder', async () => {
    write('outside/secret.json', { secret: { $type: 'color', $value: '#000' } });
    write('tokens/$metadata.json', { tokenSetOrder: ['Base', '../outside/secret', 'linked/secret'] });
    write('tokens/$themes.json', [{ id: 't', name: 'T', selectedTokenSets: { Base: 'enabled', Theme: 'enabled' } }]);
    write('tokens/Base.json', { a: { $type: 'color', $value: '#fff' } });
    write('tokens/Theme.json', { b: { $type: 'color', $value: '#eee' } });
    write('tokens/package.json', { name: 'not-a-set' });
    write('tokens/broken.json', '{ not json');
    symlinkSync(join(root, 'outside'), join(root, 'tokens', 'linked'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const system = await loadTokenSystem(join(root, 'tokens'));
    const warnings = warn.mock.calls.map((c) => c.join(' '));
    warn.mockRestore();
    expect(system.order).toEqual(['Base', 'Theme']);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('"../outside/secret"');
    expect(warnings[1]).toContain('"linked/secret"');
  });
});
