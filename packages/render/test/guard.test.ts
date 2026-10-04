/**
 * Guard against a token recipe leaking into render: no set, group or
 * theme name in render's code. Which theme falls back to which, and which
 * group is special, comes from the render table or `$themes.json` — never
 * from a string literal here.
 *
 * Two nets: every name the fixture uses must not appear as a literal, and no
 * literal may look like a set path (`Group/Name`), whatever system it came
 * from — a recipe prototype once hard-wired one set falling back to another.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const FIXTURE = fileURLToPath(new URL("../../resolver/tests/fixtures/tokens", import.meta.url));

const LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const SET_PATH = /^[A-Z][\w -]*\/[A-Z][\w -]*$/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []
  );
}

function literals(file: string): string[] {
  const code = readFileSync(file, "utf-8")
    // comments may name things; only code counts
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(LITERAL)].map((m) => m[2]);
}

function fixtureNames(): Set<string> {
  const themes = JSON.parse(readFileSync(join(FIXTURE, "$themes.json"), "utf-8")) as {
    name: string;
    group?: string;
    selectedTokenSets: Record<string, string>;
  }[];
  const meta = JSON.parse(readFileSync(join(FIXTURE, "$metadata.json"), "utf-8"));
  const names = new Set<string>(meta.tokenSetOrder);
  for (const t of themes) {
    names.add(t.name);
    if (t.group) names.add(t.group);
    for (const set of Object.keys(t.selectedTokenSets)) names.add(set);
  }
  return names;
}

describe("render knows no set names", () => {
  const files = sources(SRC);
  const names = fixtureNames();

  it("finds the sources it guards", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(names.size).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))(
    "%s has no set, group or theme name as a literal",
    (_rel, file) => {
      const leaks = literals(file).filter((lit) => names.has(lit) || SET_PATH.test(lit));
      expect(leaks).toEqual([]);
    }
  );
});
