import { describe, expect, it } from "vitest";
import { asCalc, invalidCss } from "../src/css/variables.js";
import { deriveRenderTable, InvalidCssError, renderVariables, type RenderOptions, type TokenSystem } from "../src/index.js";

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

  it("needs only a prefix: the other options default to what the resolver passes", () => {
    const rules = deriveRenderTable(SYSTEM.themes, { themeGroups: { Base: { useReferences: false } } });
    expect(renderVariables(SYSTEM, rules, { prefix: "x-" })).toEqual(files);
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

describe("output validation", () => {
  const sys = (tokens: Record<string, unknown>) =>
    system({ s: tokens }, [{ id: "t", group: "G", name: "G", selectedTokenSets: { s: "enabled" } }]);
  const render = (tokens: Record<string, unknown>) =>
    renderVariables(sys(tokens), [{ theme: "G/G", selector: ":root", references: false, file: "g.css" }], OPTIONS);

  it("refuses a bezier without four numbers, naming path, theme and file", () => {
    expect(() => render({ easing: { in: { $value: [{}, {}, {}, {}], $type: "cubicBezier" } } })).toThrow(
      /easing\.in \(theme G\/G, g\.css\): an object where CSS needs a value/
    );
    expect(() => render({ easing: { in: { $value: [0.4, 0, 1], $type: "cubicBezier" } } })).toThrow(/cubic-bezier needs four numbers/);
  });

  it("refuses an unresolved reference", () => {
    expect(() => render({ a: { $value: "{nowhere}", $type: "dimension" } })).toThrow(/unresolved reference \{nowhere\}/);
  });

  it("collects every problem before it throws", () => {
    try {
      render({ a: { $value: "{x}", $type: "number" }, b: { $value: "{y}", $type: "number" } });
      expect.unreachable();
    } catch (e) {
      expect((e as InvalidCssError).problems.map((p) => p.path)).toEqual(["a", "b"]);
    }
  });

  it("lets valid values through", () => {
    expect(() =>
      render({
        e: { $value: [0.2, 0, 0, 1], $type: "cubicBezier" },
        k: { $value: "ease-in-out", $type: "cubicBezier" },
        c: { $value: "rgba(0,0,0,0.5)", $type: "color" },
        n: { $value: "-0.5", $type: "number" },
      })
    ).not.toThrow();
  });
});

describe("invalidCss", () => {
  it.each([
    ["80rem-1px", "dimension"],
    ["var(--a) * 2px", "dimension"],
    ["2 + 3", "number"],
    ["calc(var(--a)) - 1px", "dimension"],
    ["clamp(1rem, var(--a), 3rem) * 2", "dimension"],
  ])("finds leftover math in %j", (v, t) => expect(invalidCss(v, t)).toMatch(/arithmetic/));

  it.each([
    ["calc(var(--a) - 1px)", "dimension"],
    ["calc((var(--a) - var(--b)) / 2)", "dimension"],
    ["calc(calc(var(--a) - var(--b)) / 2)", "dimension"],
    ["calc((1px + 2px) * 2)", "dimension"],
    ["clamp(1rem, calc(var(--a) - 1px), 3rem)", "dimension"],
    ["round(up, calc(var(--a) / 3), 1px)", "dimension"],
    ["max(var(--a), calc((var(--b) + 2px) * 2))", "dimension"],
    ["var(--ds-dimension-0-5x)", "dimension"],
    ["0 -1px", "dimension"],
    ["-0.05em", "dimension"],
    ["rgb(0% 0% 0% / 0.6)", "color"],
    ["700 1rem/1.5 Inter", "typography"],
  ])("accepts %j", (v, t) => expect(invalidCss(v, t)).toBeUndefined());
});

describe("presentation options", () => {
  const sys = system(
    {
      s: {
        bp: { $value: "1024px", $type: "dimension" },
        gap: { $value: "8", $type: "spacing" },
        measure: { $value: "60ch", $type: "dimension" },
        track: { $value: "-5%", $type: "letterSpacing" },
        lh: { $value: "{gap}", $type: "lineHeights" },
        ink: { $value: "#336699", $type: "color" },
        scrim: { $value: "rgba(0,0,0,0.5)", $type: "color" },
        system: { $value: "CanvasText", $type: "color" },
        soft: {
          $value: "#336699",
          $type: "color",
          $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } },
        },
      },
    },
    [{ id: "t", group: "G", name: "G", selectedTokenSets: { s: "enabled" } }]
  );
  const render = (extra: Partial<RenderOptions>) =>
    renderVariables(sys, [{ theme: "G/G", selector: ":root", references: false, file: "g.css" }], { ...OPTIONS, ...extra })
      .get("g.css")!
      .split("\n")
      .filter((l) => l.startsWith("  --"));

  it("defaults write what the resolver wrote", () => {
    expect(render({})).toEqual(render({ units: "rem", color: "rgb" }));
    expect(render({})).toEqual([
      "  --x-bp: 64rem;",
      "  --x-gap: 0.5rem;",
      "  --x-measure: 60ch;",
      "  --x-track: -0.05em;",
      "  --x-lh: 0.5rem;",
      "  --x-ink: rgb(51, 102, 153);",
      "  --x-scrim: rgba(0, 0, 0, 0.5);",
      "  --x-system: CanvasText;",
      // Kept from the Style-Dictionary output, in this dialect only: core computes
      // rgb(20% 40% 60% / 0.5) for a literal with an alpha modifier, then the
      // literal colour step reads it as opaque. 'canonical' does not.
      "  --x-soft: rgb(51, 102, 153);",
    ]);
  });

  it("units: 'source' keeps lengths as the canonical value has them", () => {
    expect(render({ units: "source" })).toEqual([
      "  --x-bp: 1024px;",
      "  --x-gap: 8px;",
      "  --x-measure: 60ch;",
      "  --x-track: -0.05em;",
      "  --x-lh: 8px;",
      "  --x-ink: rgb(51, 102, 153);",
      "  --x-scrim: rgba(0, 0, 0, 0.5);",
      "  --x-system: CanvasText;",
      "  --x-soft: rgb(51, 102, 153);",
    ]);
  });

  it("color: 'source' keeps colour literals, computed colours still come from core", () => {
    expect(render({ color: "source" }).slice(5)).toEqual([
      "  --x-ink: #336699;",
      "  --x-scrim: rgba(0,0,0,0.5);",
      "  --x-system: CanvasText;",
      "  --x-soft: rgb(20% 40% 60% / 0.5);",
    ]);
  });
});

describe("dialect 'canonical' leaves what the 'style-dictionary' dialect inherited", () => {
  const sys = (sets: Record<string, unknown>) =>
    system({ s: sets as Record<string, unknown> }, [{ id: "t", group: "G", name: "G", selectedTokenSets: { s: "enabled" } }]);
  const lines = (s: TokenSystem, extra: Partial<RenderOptions>, references = true) =>
    renderVariables(s, [{ theme: "G/G", selector: ":root", references, file: "g.css" }], { ...OPTIONS, ...extra })
      .get("g.css")!
      .split("\n")
      .filter((l) => l.startsWith("  --"));

  it("keeps a colour a modifier computed, also with color: 'rgb'", () => {
    const s = sys({
      soft: {
        $value: "#336699",
        $type: "color",
        $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } },
      },
    });
    expect(lines(s, { color: "rgb" }, false)).toEqual(["  --x-soft: rgb(51, 102, 153);"]);
    expect(lines(s, { dialect: "canonical", color: "rgb" }, false)).toEqual(["  --x-soft: rgb(20% 40% 60% / 0.5);"]);
  });

  it("writes each reference of a composite in its own property's place", () => {
    const s = sys({
      lh: { $value: "16px", $type: "lineHeights" },
      blur: { $value: "4px", $type: "dimension" },
      body: { $value: { fontFamily: "Inter", fontWeight: "400", fontSize: "16px", lineHeight: "{lh}" }, $type: "typography" },
      lift: { $value: { offsetX: "4px", offsetY: "4px", blur: "{blur}", spread: "0", color: "#000000" }, $type: "boxShadow" },
    });
    // by value, the line height's variable takes the font size's place (the blur only
    // escapes because this dialect writes it as 0.25rem, which the offsets do not match)
    expect(lines(s, {}).slice(2)).toEqual([
      "  --x-body: 400 var(--x-lh)/16px Inter;",
      "  --x-lift: 4px 4px var(--x-blur) 0 #000000;",
    ]);
    expect(lines(s, { dialect: "canonical" }).slice(2)).toEqual([
      "  --x-body: 400 16px/var(--x-lh) Inter;",
      "  --x-lift: 4px 4px var(--x-blur) 0 #000000;",
    ]);
  });

  it("keeps source order: var() resolves at computed-value time, no definition-before-use sort", () => {
    const s = sys({
      alias: { $value: "{base}", $type: "dimension" },
      base: { $value: "8px", $type: "dimension" },
    });
    expect(lines(s, {})).toEqual(["  --x-base: 0.5rem;", "  --x-alias: var(--x-base);"]);
    expect(lines(s, { dialect: "canonical" })).toEqual(["  --x-alias: var(--x-base);", "  --x-base: 8px;"]);
  });
});
