/**
 * The output policy over the synthetic fixture the resolver's E2E test uses.
 * The render-API defaults (everything as written, no companions) are guarded
 * by the snapshot here; the CLI's Tokens-Studio policy by the E2E snapshot.
 * Both write the same files, blocks and names; values and companions differ.
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
const DEFAULTS: RenderOptions = { prefix: "ds-" };
const STUDIO: RenderOptions = { prefix: "ds-", units: "tokens-studio", color: "rgb", typographyCompanions: true };
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

describe("render-API defaults", () => {
  const files = renderVariables(system, rules, DEFAULTS);

  it("renders the fixture as committed", () => {
    expect(Object.fromEntries(files)).toMatchSnapshot();
    expect(JSON.parse(renderTokenMap(system, DEFAULTS).get("token-map.json")!)).toMatchSnapshot();
  });

  it("writes no typography companions and ends every file with a newline", () => {
    for (const [file, css] of files) {
      expect(css.split("\n").filter((l) => COMPANION.test(l)), file).toEqual([]);
      expect(css.endsWith("}\n"), file).toBe(true);
    }
    const map = JSON.parse(renderTokenMap(system, DEFAULTS).get("token-map.json")!);
    expect(Object.keys(map.figmaToCSS).filter((p) => /\/(letterSpacing|textTransform|textDecoration)$/.test(p))).toEqual([]);
  });

  it("keeps lengths and colour literals as written", () => {
    const all = [...files.values()].join("\n");
    expect(all).not.toMatch(/\d+(\.\d+)?rem\b/);
    expect(all).not.toMatch(/rgba?\(\d+, \d+, \d+/);
    expect(all).toMatch(/: -?\d+(\.\d+)?px;/);
    expect(all).toContain("0 rgba(0,0,0,0.08);");
  });
});

describe("Tokens-Studio policy", () => {
  const files = renderVariables(system, rules, STUDIO);

  it("converts by type and writes companions", () => {
    const css = [...files.values()].join("\n");
    expect(css).toContain("--ds-dimension-4x: 1rem;");
    // typed `dimension` in the fixture, so rem; a `borderWidth` token would stay px
    expect(css).toContain("--ds-border-width-thin: 0.0625rem;");
    expect(css).toContain("--ds-line-heights-body-small: 20px;");
    expect(css).toMatch(/-letter-spacing: var\(/);
    expect(css).toContain("0 rgba(0, 0, 0, 0.08)");
  });

  it("changes values and companions only: same files, blocks and names", () => {
    const plain = renderVariables(system, rules, DEFAULTS);
    expect([...files.keys()]).toEqual([...plain.keys()]);
    for (const [file, css] of files) {
      const want = shape(css).map((b) => ({ ...b, names: b.names.filter((n) => !COMPANION.test(`  ${n}: `)) }));
      expect(shape(plain.get(file)!), file).toEqual(want);
    }
    const studio = JSON.parse(renderTokenMap(system, STUDIO).get("token-map.json")!).figmaToCSS;
    const map = JSON.parse(renderTokenMap(system, DEFAULTS).get("token-map.json")!).figmaToCSS;
    for (const [path, name] of Object.entries(map)) expect(studio[path], path).toBe(name);
  });
});

describe("typography builders", () => {
  it("refuse without companions, run with them", async () => {
    await expect(renderUtilities(system, [typography()], DEFAULTS)).rejects.toThrow(/typography\(\).*typographyCompanions: true/);
    await expect(renderUtilities(system, [typographyMixin()], DEFAULTS)).rejects.toThrow(/typographyMixin\(\)/);
    await expect(renderUtilities(system, [typography(), typographyMixin()], STUDIO)).resolves.toBeDefined();
  });
});
