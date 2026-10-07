import { describe, expect, it } from "vitest";
import { asCalc } from "../src/css/variables.js";
import { deriveRenderTable, InvalidCssError, renderVariables, type RenderOptions, type TokenSystem } from "../src/index.js";

const OPTIONS: RenderOptions = { prefix: "x-" };
const STUDIO: RenderOptions = { prefix: "x-", units: "tokens-studio", color: "rgb" };

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
  { id: "1", group: "Base", name: "Base", selectedTokenSets: { base: "enabled" } },
  { id: "2", group: "Mode", name: "Light", selectedTokenSets: { base: "source", light: "enabled" } },
  { id: "3", group: "Mode", name: "Dark", selectedTokenSets: { base: "source", dark: "enabled" } },
];

const SYSTEM = system({ base: BASE, light: MODE_LIGHT, dark: MODE_DARK }, THEMES);
const TABLE = deriveRenderTable(SYSTEM.themes, { themeGroups: { Base: { useReferences: false } } });

const one = (sets: Record<string, unknown>) =>
  system({ s: sets as Record<string, unknown> }, [{ id: "t", group: "G", name: "G", selectedTokenSets: { s: "enabled" } }]);

const lines = (s: TokenSystem, options: RenderOptions, references = true) =>
  renderVariables(s, [{ theme: "G/G", selector: ":root", references, file: "g.css" }], options)
    .get("g.css")!
    .split("\n")
    .filter((l) => l.startsWith("  --"));

describe("renderVariables", () => {
  it("writes resolved values as written by default, private tokens left out", () => {
    expect(renderVariables(SYSTEM, TABLE, OPTIONS).get("variables/base.css")).toBe(
      [
        "/**",
        " * Do not edit directly, this file was auto-generated.",
        " */",
        "",
        ":root {",
        "  --x-size-s: 8px;",
        "  --x-size-m: 16px;",
        "  --x-size-zero: 0px;",
        "  --x-color-ink: #336699;",
        "  --x-color-soft: rgb(20% 40% 60% / 0.5);",
        "  --x-line: 1.5;",
        "  --x-family: 'JetBrains Mono';",
        "}",
        "",
      ].join("\n")
    );
  });

  it("writes the Tokens-Studio policy: rem, rgb() literals, computed colours as rgb(r% g% b%)", () => {
    expect(renderVariables(SYSTEM, TABLE, STUDIO).get("variables/base.css")).toContain(
      [
        "  --x-size-s: 0.5rem;",
        "  --x-size-m: 1rem;",
        "  --x-size-zero: 0;",
        "  --x-color-ink: rgb(51, 102, 153);",
        "  --x-color-soft: rgb(20% 40% 60% / 0.5);",
        "  --x-line: 1.5;",
      ].join("\n")
    );
  });

  it("writes references as var(), arithmetic over a variable as calc(), one block per theme", () => {
    expect(renderVariables(SYSTEM, TABLE, OPTIONS).get("variables/mode.css")).toBe(
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

  it("keeps source order: var() resolves at computed-value time", () => {
    const s = one({ alias: { $value: "{base}", $type: "dimension" }, base: { $value: "8px", $type: "dimension" } });
    expect(lines(s, OPTIONS)).toEqual(["  --x-alias: var(--x-base);", "  --x-base: 8px;"]);
  });

  it("writes each reference of a composite in its own property's place", () => {
    const s = one({
      lh: { $value: "16px", $type: "lineHeights" },
      blur: { $value: "4px", $type: "dimension" },
      body: { $value: { fontFamily: "Inter", fontWeight: "400", fontSize: "16px", lineHeight: "{lh}" }, $type: "typography" },
      lift: { $value: [{ x: "4", y: "4", blur: "{blur}", spread: "0", color: "#000000" }], $type: "boxShadow" },
    });
    expect(lines(s, STUDIO).slice(2)).toEqual([
      "  --x-body: 400 1rem/var(--x-lh) Inter;",
      "  --x-lift: 4px 4px var(--x-blur) 0 rgb(0, 0, 0);",
    ]);
  });

  it("writes a computed colour as computed, unless the modifier changed nothing", () => {
    const s = one({
      ink: { $value: "#336699", $type: "color" },
      soft: { $value: "{ink}", $type: "color", $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } } },
      same: { $value: "{ink}", $type: "color", $extensions: { "studio.tokens": { modify: { type: "lighten", value: "0", space: "srgb" } } } },
    });
    expect(lines(s, OPTIONS).slice(1)).toEqual(["  --x-soft: rgb(20% 40% 60% / 0.5);", "  --x-same: var(--x-ink);"]);
  });

  it("writes typography companions and the tabular flag with typographyCompanions", () => {
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
    const render = (extra: Partial<RenderOptions>) =>
      renderVariables(sys, [{ theme: "T/T", selector: ":root", references: true, file: "t.css" }], {
        ...OPTIONS,
        typography: { fontVariantNumeric: { tabular: [["mono"]] } },
        ...extra,
      }).get("t.css");
    expect(render({ typographyCompanions: true })).toBe(
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
        "}",
        "",
      ].join("\n")
    );
    expect(render({})).not.toContain("letter-spacing");
  });

  it("names an unknown theme", () => {
    expect(() => renderVariables(SYSTEM, [{ theme: "Nope/Nope", selector: ":root", references: true, file: "n.css" }], OPTIONS)).toThrow(
      /Nope\/Nope/
    );
  });
});

describe("unit policy", () => {
  const s = one({
    bp: { $value: "1024px", $type: "dimension" },
    gap: { $value: "8", $type: "spacing" },
    measure: { $value: "60ch", $type: "dimension" },
    half: { $value: "0.5rem", $type: "sizing" },
    border: { $value: "1", $type: "borderWidth" },
    track: { $value: "-5%", $type: "letterSpacing" },
    trackPx: { $value: "1px", $type: "letterSpacing" },
    lh: { $value: "{gap}", $type: "lineHeights" },
    calc: { $value: "80rem - 16px", $type: "dimension" },
    pad: { $value: "0 8 16px", $type: "spacing" },
  });
  const render = (extra: Partial<RenderOptions>) => lines(s, { prefix: "x-", ...extra }, false);

  it("source writes lengths as core resolved them", () => {
    expect(render({})).toEqual([
      "  --x-bp: 1024px;",
      "  --x-gap: 8px;",
      "  --x-measure: 60ch;",
      "  --x-half: 0.5rem;",
      "  --x-border: 1px;",
      "  --x-track: -0.05em;",
      "  --x-track-px: 1px;",
      "  --x-lh: 8px;",
      "  --x-calc: calc(80rem - 16px);",
      "  --x-pad: 0px 8px 16px;",
    ]);
  });

  it("tokens-studio converts px by type and leaves other units", () => {
    expect(render({ units: "tokens-studio" })).toEqual([
      "  --x-bp: 64rem;",
      "  --x-gap: 0.5rem;",
      "  --x-measure: 60ch;",
      "  --x-half: 0.5rem;",
      "  --x-border: 1px;",
      "  --x-track: -0.05em;",
      "  --x-track-px: 1px;",
      "  --x-lh: 8px;",
      "  --x-calc: calc(80rem - 1rem);",
      "  --x-pad: 0 0.5rem 1rem;",
    ]);
  });

  it("looks up the own type before the aligned type, path rules before both", () => {
    expect(render({ units: { types: { dimension: "rem", spacing: "px" }, paths: [{ match: "bp", unit: "px" }] } })).toEqual([
      "  --x-bp: 1024px;",
      "  --x-gap: 8px;",
      "  --x-measure: 60ch;",
      "  --x-half: 0.5rem;",
      "  --x-border: 0.0625rem;",
      "  --x-track: -0.05em;",
      "  --x-track-px: 0.0625rem;",
      "  --x-lh: 8px;",
      "  --x-calc: calc(80rem - 1rem);",
      "  --x-pad: 0 8px 16px;",
    ]);
  });

  it("matches paths with * for one segment and ** for any", () => {
    const deep = one({ a: { b: { c: { $value: "16", $type: "dimension" } }, d: { $value: "16", $type: "dimension" } } });
    const at = (match: string) => lines(deep, { prefix: "x-", units: { types: { dimension: "rem" }, paths: [{ match, unit: "px" }] } }, false);
    expect(at("a.*")).toEqual(["  --x-a-b-c: 1rem;", "  --x-a-d: 16px;"]);
    expect(at("a.**")).toEqual(["  --x-a-b-c: 16px;", "  --x-a-d: 16px;"]);
    expect(at("**.c")).toEqual(["  --x-a-b-c: 16px;", "  --x-a-d: 1rem;"]);
  });

  it("divides by basePxFontSize", () => {
    expect(lines(one({ a: { $value: "20px", $type: "dimension" } }), { prefix: "x-", units: "tokens-studio", basePxFontSize: 10 }, false)).toEqual([
      "  --x-a: 2rem;",
    ]);
  });

  it("formats a shadow's lengths under the shadow's type", () => {
    const shadow = one({ s: { $value: { x: "0", y: "2", blur: "8", spread: "0", color: "#000" }, $type: "boxShadow" } });
    expect(lines(shadow, { prefix: "x-", units: "tokens-studio" }, false)).toEqual(["  --x-s: 0 2px 8px 0 #000;"]);
  });
});

describe("colour form", () => {
  const s = one({
    ink: { $value: "#336699", $type: "color" },
    scrim: { $value: "rgba(0,0,0,0.5)", $type: "color" },
    studio: { $value: "rgba(#336699, 0.5)", $type: "color" },
    system: { $value: "CanvasText", $type: "color" },
    wide: { $value: "lch(62 72 250)", $type: "color" },
    soft: { $value: "#336699", $type: "color", $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } } },
  });
  const render = (color: RenderOptions["color"]) => lines(s, { prefix: "x-", color }, false);

  it("source keeps literals; a Tokens-Studio rgba(<colour>, a) is written as rgba()", () => {
    expect(render("source")).toEqual([
      "  --x-ink: #336699;",
      "  --x-scrim: rgba(0,0,0,0.5);",
      "  --x-studio: rgba(51, 102, 153, 0.5);",
      "  --x-system: CanvasText;",
      "  --x-wide: lch(62 72 250);",
      "  --x-soft: rgb(20% 40% 60% / 0.5);",
    ]);
  });

  it("rgb writes literals as rgb()/rgba(), gamut-mapped", () => {
    expect(render("rgb")).toEqual([
      "  --x-ink: rgb(51, 102, 153);",
      "  --x-scrim: rgba(0, 0, 0, 0.5);",
      "  --x-studio: rgba(51, 102, 153, 0.5);",
      "  --x-system: CanvasText;",
      "  --x-wide: rgb(0, 165, 233);",
      "  --x-soft: rgb(20% 40% 60% / 0.5);",
    ]);
  });

  it("hex writes every colour as hex", () => {
    expect(render("hex")).toEqual([
      "  --x-ink: #336699;",
      "  --x-scrim: #00000080;",
      "  --x-studio: #33669980;",
      "  --x-system: CanvasText;",
      "  --x-wide: #00a5e9;",
      "  --x-soft: #33669980;",
    ]);
  });
});

describe("asCalc (arithmetic over variables)", () => {
  it.each([
    ["var(--a)-1px", "calc(var(--a) - 1px)"],
    ["var(--a) * 2", "calc(var(--a) * 2)"],
    ["var(--a)+var(--b)/2", "calc(var(--a) + var(--b) / 2)"],
  ])("%s → %s", (input, out) => expect(asCalc(input)).toBe(out));

  it.each(["-0.05em", "var(--a)", "0 4px 8px 0", "cubic-bezier(0.2, 0, 0, 1)"])("leaves %j alone", (input) => expect(asCalc(input)).toBe(input));
});

describe("output validation", () => {
  const render = (tokens: Record<string, unknown>) => renderVariables(one(tokens), [{ theme: "G/G", selector: ":root", references: false, file: "g.css" }], OPTIONS);

  it("refuses a bezier without four numbers, naming path, theme and file", () => {
    expect(() => render({ easing: { in: { $value: [{}, {}, {}, {}], $type: "cubicBezier" } } })).toThrow(
      /easing\.in \(theme G\/G, g\.css\): cubic-bezier needs four numbers/
    );
    expect(() => render({ easing: { in: { $value: [0.4, 0, 1], $type: "cubicBezier" } } })).toThrow(/cubic-bezier needs four numbers/);
  });

  it("refuses an unresolved reference and an object where text belongs", () => {
    expect(() => render({ a: { $value: "{nowhere}", $type: "dimension" } })).toThrow(/unresolved reference \{nowhere\}/);
    expect(() => render({ a: { $value: { odd: 1 }, $type: "other" } })).toThrow(/an object where CSS needs a value/);
  });

  it("refuses arithmetic CSS cannot compute", () => {
    expect(() => render({ a: { $value: "2px * 3rem", $type: "dimension" } })).toThrow(/arithmetic CSS cannot compute/);
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
        m: { $value: "80rem - 1px", $type: "dimension" },
      })
    ).not.toThrow();
  });
});
