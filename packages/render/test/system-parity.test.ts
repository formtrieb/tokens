/**
 * The one resolution in core against the CSS value chain here: for every
 * token of every theme of the synthetic fixture, the typed value core
 * resolves means what the 'canonical' dialect writes. Formatting does not
 * count (`16px` and `{ length 16 px }` agree, a colour agrees within rounding);
 * meaning does. Every deliberate difference is listed in DIFFERENCES.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import {
  alphaOf,
  buildTokenSystem,
  composeTheme,
  deltaEOK,
  formatColor,
  resolveDictionary,
  textOf,
  type TokenValue,
} from "@formtrieb/tokens-core";
import { buildDictionary } from "../src/css/dictionary.js";
import { finishValues } from "../src/css/values.js";
import type { TokenSystem } from "../src/types.js";

const FIXTURE = fileURLToPath(new URL("../../resolver/tests/fixtures/tokens/", import.meta.url));

function readFiles(dir: string): Map<string, unknown> {
  const files = new Map<string, unknown>();
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) files.set(relative(dir, full).split("\\").join("/"), JSON.parse(readFileSync(full, "utf-8")));
    }
  };
  walk(dir);
  return files;
}

/** Theme id + token key → why the old value means something else. */
const DIFFERENCES: Record<string, string> = {};

const EPS = 1e-4;
const near = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps;

/** Split at spaces and commas outside parentheses. */
function split(text: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && sep.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function sameColor(old: string, value: TokenValue): boolean {
  if (value.kind !== "color") return false;
  if (!value.color) return value.literal === old;
  // Both gamut-mapped to 8-bit sRGB: the old chain rounded to five significant digits.
  const [a, b] = [formatColor(old, "hex8"), formatColor(textOf(value), "hex8")];
  return deltaEOK(a, b) < 0.005 && near(alphaOf(a), alphaOf(b), 0.01);
}

/** Whether the old finished value means the same as the typed value. */
function same(old: unknown, value: TokenValue): boolean {
  const text = `${old}`.trim();
  switch (value.kind) {
    case "length": {
      const m = text.match(/^(-?[\d.]+)([a-z%]*)$/);
      if (!m || !near(Number(m[1]), value.value)) return false;
      return value.value === 0 || m[2] === value.unit;
    }
    case "number":
      return near(Number(text), value.value);
    case "fontWeight":
      return text === (value.style ? `${value.value} ${value.style}` : `${value.value}`);
    case "fontFamily":
      return split(text, /,/).map((f) => f.trim().replace(/^'(.*)'$/, "$1")).join("|") === value.families.join("|");
    case "duration":
      return text === `${value.value}${value.unit}`;
    case "cubicBezier":
      return text === `cubic-bezier(${value.points.join(", ")})`;
    case "string":
      return text === value.value;
    case "color":
      return sameColor(text, value);
    case "typography": {
      // `weight size/lineHeight family`; the rest goes into companions, not the shorthand.
      const m = text.match(/^(\S+) (\S+)\/(\S+) (.+)$/);
      return (
        !!m &&
        !!value.fontWeight && same(m[1], value.fontWeight) &&
        !!value.fontSize && same(m[2], value.fontSize) &&
        !!value.lineHeight && same(m[3], value.lineHeight) &&
        !!value.fontFamily && same(m[4], value.fontFamily)
      );
    }
    case "shadow": {
      const layers = split(text, /,/).map((l) => l.trim());
      if (layers.length !== value.layers.length) return false;
      return value.layers.every((layer, i) => {
        const parts = split(layers[i], /\s/);
        const inset = parts[0] === "inset";
        if (inset) parts.shift();
        if (inset !== layer.inset || parts.length !== 5) return false;
        const [x, y, blur, spread, color] = parts;
        return same(x, layer.offsetX) && same(y, layer.offsetY) && same(blur, layer.blur) && same(spread, layer.spread) && same(color, layer.color);
      });
    }
    default:
      return false;
  }
}

describe("one resolution in core means what render writes", () => {
  const { system, problems: loadProblems } = buildTokenSystem(readFiles(FIXTURE));

  it("loads the fixture without problems", () => {
    expect(loadProblems).toEqual([]);
  });

  it("every token of every theme agrees, apart from the listed differences", () => {
    const differences: Record<string, string> = {};
    let compared = 0;
    for (const theme of system.themes) {
      const id = `${theme.group}/${theme.name}`;
      const old = finishValues(buildDictionary(system as TokenSystem, theme), {
        basePxFontSize: 16,
        units: "source",
        color: "source",
        dialect: "canonical",
      });
      const dict = composeTheme(system, theme);
      const { values, problems } = resolveDictionary(dict);
      expect(problems, id).toEqual([]);
      expect([...values.keys()].sort(), id).toEqual([...old.keys()].sort());
      for (const [key, resolution] of values) {
        compared++;
        if (!same(old.get(key), resolution.value)) {
          differences[`${id} ${key}`] = `${JSON.stringify(old.get(key))} ≠ ${JSON.stringify(resolution.value)}`;
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
    expect(Object.keys(differences).sort()).toEqual(Object.keys(DIFFERENCES).sort());
  });
});
