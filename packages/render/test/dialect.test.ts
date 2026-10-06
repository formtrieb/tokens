/**
 * The two dialects over the synthetic fixture the resolver's E2E test uses.
 * 'style-dictionary' is guarded by that E2E snapshot; 'canonical' by the
 * snapshot here. Both must agree on everything but values and companions.
 */
import { readFileSync } from "node:fs";
import { parseThemes } from "@formtrieb/tokens-core";
import { describe, expect, it } from "vitest";
import {
  deriveRenderTable,
  renderTokenMap,
  renderUtilities,
  renderVariables,
  typography,
  typographyMixin,
  type RenderOptions,
  type TokenSystem,
} from "../src/index.js";

const FIXTURE = new URL("../../resolver/tests/fixtures/tokens/", import.meta.url);
const json = (file: string) => JSON.parse(readFileSync(new URL(file, FIXTURE), "utf8"));

function loadFixture(): TokenSystem {
  const order: string[] = json("$metadata.json").tokenSetOrder;
  return {
    order,
    sets: new Map(order.map((set) => [set, json(`${set}.json`)])),
    themes: parseThemes(json("$themes.json")),
  };
}

const system = loadFixture();
const rules = deriveRenderTable(system.themes);
const SD: RenderOptions = { prefix: "ds-" };
const CANONICAL: RenderOptions = { prefix: "ds-", dialect: "canonical" };
const COMPANION = /^ {2}--[\w-]+-(letter-spacing|text-transform|text-decoration|text-indent|margin-block-end|fvn): /;

/** per block: media + selector, and the declared variable names */
function shape(css: string) {
  const blocks: { at: string; names: string[] }[] = [];
  let media = "";
  for (const line of css.split("\n")) {
    if (line.startsWith("@media")) media = line;
    else if (line.endsWith("{")) blocks.push({ at: `${media} ${line}`, names: [] });
    else if (line.startsWith("  --")) blocks[blocks.length - 1].names.push(line.slice(2, line.indexOf(":")));
    else if (line === "}" && blocks.length && media) media = "";
  }
  return blocks;
}

describe("dialect 'canonical'", () => {
  const files = renderVariables(system, rules, CANONICAL);

  it("renders the fixture as committed", () => {
    expect(Object.fromEntries(files)).toMatchSnapshot();
    expect(JSON.parse(renderTokenMap(system, CANONICAL).get("token-map.json")!)).toMatchSnapshot();
  });

  it("writes no typography companions and ends every file with a newline", () => {
    for (const [file, css] of files) {
      expect(css.split("\n").filter((l) => COMPANION.test(l)), file).toEqual([]);
      expect(css.endsWith("}\n"), file).toBe(true);
    }
    const map = JSON.parse(renderTokenMap(system, CANONICAL).get("token-map.json")!);
    expect(Object.keys(map.figmaToCSS).filter((p) => /\/(letterSpacing|textTransform|textDecoration)$/.test(p))).toEqual([]);
  });

  it("keeps lengths and colours as the canonical value has them", () => {
    const all = [...files.values()].join("\n");
    expect(all).not.toMatch(/\d+(\.\d+)?rem\b/);
    // a colour literal is not rewritten to rgb(r, g, b) — what the source wrote stays
    expect(all).not.toMatch(/rgba?\(\d+, \d+, \d+/);
    expect(all).toMatch(/: -?\d+(\.\d+)?px;/);
    // a literal stays as written; a modified colour (colors.white) is computed by core
    expect(all).toContain("0 rgba(0,0,0,0.08);");
  });

  it("changes values, companions and order only: same files, blocks and names", () => {
    const sd = renderVariables(system, rules, SD);
    expect([...files.keys()]).toEqual([...sd.keys()]);
    for (const [file, css] of sd) {
      // 'canonical' keeps source order, 'style-dictionary' sorts by reference
      const sorted = (blocks: ReturnType<typeof shape>) => blocks.map((b) => ({ ...b, names: [...b.names].sort() }));
      const want = shape(css).map((b) => ({ ...b, names: b.names.filter((n) => !COMPANION.test(`  ${n}: `)) }));
      expect(sorted(shape(files.get(file)!)), file).toEqual(sorted(want));
    }
    const sdMap = JSON.parse(renderTokenMap(system, SD).get("token-map.json")!).figmaToCSS;
    const map = JSON.parse(renderTokenMap(system, CANONICAL).get("token-map.json")!).figmaToCSS;
    for (const [path, name] of Object.entries(map)) expect(sdMap[path], path).toBe(name);
  });

  it("keeps units and color as fine switches", () => {
    const css = [...renderVariables(system, rules, { ...CANONICAL, units: "rem", color: "rgb" }).values()].join("\n");
    expect(css).toMatch(/\d+(\.\d+)?rem\b/);
    // a colour a modifier computed stays as core wrote it; the fixture has no other colour literal
    expect(css).toContain("--ds-colors-white: rgb(100% 100% 100%);");
    expect(css.split("\n").filter((l) => COMPANION.test(l))).toEqual([]);
  });

  it("refuses the typography builders, which read companions", async () => {
    await expect(renderUtilities(system, [typography()], CANONICAL)).rejects.toThrow(/typography\(\).*'canonical' dialect/);
    await expect(renderUtilities(system, [typographyMixin()], CANONICAL)).rejects.toThrow(/typographyMixin\(\)/);
    await expect(renderUtilities(system, [typography(), typographyMixin()], SD)).resolves.toBeDefined();
  });
});

describe("dialect 'style-dictionary'", () => {
  it("is the default", () => {
    const css = (o: RenderOptions) => [...renderVariables(system, rules, o).values()].join("\n");
    expect(css({ ...SD, dialect: "style-dictionary" })).toBe(css(SD));
    expect(css(SD)).toMatch(/-letter-spacing: var\(/);
  });
});
