import { describe, expect, it } from "vitest";
import { asCalc } from "../src/css/variables.js";
import { deriveRenderTable, renderVariables, type RenderOptions, type TokenSystem } from "../src/index.js";

const OPTIONS: RenderOptions = {
  prefix: "x-",
  basePxFontSize: 16,
  privateTokenPrefixes: ["*"],
  typography: {},
};

function system(sets: Record<string, Record<string, unknown>>, themes: TokenSystem["themes"]): TokenSystem {
  return { order: Object.keys(sets), sets: new Map(Object.entries(sets)), themes };
}

const BASE = {
  size: {
    s: { $value: "8", $type: "dimension" },
    m: { $value: "{size.s} * 2", $type: "dimension" },
    zero: { $value: "0px", $type: "spacing" },
  },
  "*helper": { $value: "4", $type: "number" },
  color: {
    ink: { $value: "#336699", $type: "color" },
    soft: {
      $value: "{color.ink}",
      $type: "color",
      $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } },
    },
  },
  line: { $value: "150%", $type: "lineHeights" },
  family: { $value: "JetBrains Mono", $type: "fontFamilies" },
};

const MODE_LIGHT = { surface: { $value: "{color.ink}", $type: "color" }, gap: { $value: "{size.s}-1px", $type: "dimension" } };
const MODE_DARK = { surface: { $value: "{color.soft}", $type: "color" }, gap: { $value: "{size.m}", $type: "dimension" } };

const THEMES: TokenSystem["themes"] = [
  { id: "1", group: "Base", name: "Base", selectedTokenSets: { base: "enabled"} },
  { id: "2", group: "Mode", name: "Light", selectedTokenSets: { base: "source", light: "enabled"} },
  { id: "3", group: "Mode", name: "Dark", selectedTokenSets: { base: "source", dark: "enabled"} },
];

const SYSTEM = system({ base: BASE, light: MODE_LIGHT, dark: MODE_DARK }, THEMES);

describe("renderVariables", () => {
  const files = renderVariables(
    SYSTEM,
    deriveRenderTable(SYSTEM.themes, { themeGroups: { Base: { useReferences: false } } }),
    OPTIONS
  );

  it("writes resolved values for a group without references, private tokens left out", () => {
    expect(files.get("variables/base.css")).toBe(
      [
        "/**",
        " * Do not edit directly, this file was auto-generated.",
        " */",
        "",
        ":root {",
        "  --x-size-s: 0.5rem;",
        "  --x-size-m: 1rem;",
        "  --x-size-zero: 0;",
        "  --x-color-ink: rgb(51, 102, 153);",
        "  --x-color-soft: rgb(20% 40% 60% / 0.5);",
        "  --x-line: 1.5;",
        "  --x-family: 'JetBrains Mono';",
        "}",
        "",
      ].join("\n")
    );
  });

  it("writes references as var(), mixed-unit math as calc(), one block per theme", () => {
    expect(files.get("variables/mode.css")).toBe(
      [
        "/**",
        " * Do not edit directly, this file was auto-generated.",
        " */",
        "",
        '[data-mode="Light"] {',
        "  --x-surface: var(--x-color-ink);",
        "  --x-gap: calc(var(--x-size-s) - 1px);",
        "}",
        '[data-mode="Dark"] {',
        "  --x-surface: var(--x-color-soft);",
        "  --x-gap: var(--x-size-m);",
        "}",
        "",
      ].join("\n")
    );
  });

  it("takes the fallback order from $themes.json: the later set wins", () => {
    const sys = system(
      { a: { v: { $value: "1", $type: "number" } }, b: { v: { $value: "2", $type: "number" } }, out: { w: { $value: "{v}", $type: "number" } } },
      [{ id: "t", group: "G", name: "G", selectedTokenSets: { b: "source", a: "source", out: "enabled" } }]
    );
    const css = renderVariables(sys, [{ theme: "G/G", selector: ":root", references: false, file: "g.css" }], OPTIONS);
    expect(css.get("g.css")).toContain("--x-w: 1;");
  });

  it("appends typography companions and the tabular flag", () => {
    const sys = system(
      {
        t: {
          ls: { $value: "-5%", $type: "letterSpacing" },
          mono: {
            $type: "typography",
            $value: { fontFamily: "Inter", fontSize: "14", lineHeight: "20px", fontWeight: "bold", letterSpacing: "{ls}" },
          },
        },
      },
      [{ id: "t", group: "T", name: "T", selectedTokenSets: { t: "enabled" } }]
    );
    const css = renderVariables(sys, [{ theme: "T/T", selector: ":root", references: true, file: "t.css" }], {
      ...OPTIONS,
      typography: { fontVariantNumeric: { tabular: [["mono"]] } },
    });
    expect(css.get("t.css")).toBe(
      [
        "/**",
        " * Do not edit directly, this file was auto-generated.",
        " */",
        "",
        ":root {",
        "  --x-ls: -0.05em;",
        "  --x-mono: 700 14px/20px Inter;",
        "  --x-mono-letter-spacing: var(--x-ls);",
        "  --x-mono-fvn: tabular-nums;",
        "",
        "}",
      ].join("\n")
    );
  });

  it("names an unknown theme", () => {
    expect(() => renderVariables(SYSTEM, [{ theme: "Nope/Nope", selector: ":root", references: true, file: "n.css" }], OPTIONS)).toThrow(
      /Nope\/Nope/
    );
  });
});

describe("asCalc", () => {
  it.each([
    ["var(--a)-1px", "calc(var(--a) - 1px)"],
    ["1024px-1px", "calc(1024px - 1px)"],
    ["var(--a) * 2", "calc(var(--a) * 2)"],
    ["var(--a)+var(--b)/2", "calc(var(--a) + var(--b) / 2)"],
  ])("%s → %s", (input, out) => expect(asCalc(input)).toBe(out));

  it.each(["-0.05em", "1.5", "0", "var(--a)", "0 4px 8px 0", "700 1rem/1.5 Inter", "cubic-bezier(0.2, 0, 0, 1)", "rgb(0% 0% 0% / 0.6)"])(
    "leaves %j alone",
    (input) => expect(asCalc(input)).toBe(input)
  );
});
