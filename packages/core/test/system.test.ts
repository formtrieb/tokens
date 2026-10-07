import { describe, expect, it } from "vitest";
import {
  buildTokenSystem,
  compose,
  composeTheme,
  referencesIn,
  resolveDictionary,
  resolveToken,
  textOf,
  cssColor,
  type TokenSystem,
  type TokenValue,
} from "../src/index.js";
import { readFixture } from "./fixture.js";

type Json = Record<string, unknown>;

/** A system of the given sets, every set enabled in one theme `t/t`, in the given order. */
function system(sets: Record<string, Json>): TokenSystem {
  const files = new Map<string, unknown>(Object.entries(sets).map(([name, json]) => [`${name}.json`, json]));
  files.set("$themes.json", [{ id: "t", name: "t", group: "t", selectedTokenSets: Object.fromEntries(Object.keys(sets).map((s) => [s, "enabled"])) }]);
  return buildTokenSystem(files).system;
}

/** The value of `key` in a one-set system. */
function valueOf(tokens: Json, key: string): TokenValue {
  return resolveToken(compose(system({ a: tokens }), [{ set: "a", state: "enabled" }]), key).value;
}

const tok = (type: string | undefined, value: unknown, extra: Json = {}) => ({ ...(type && { $type: type }), $value: value, ...extra });
const length = (value: number, unit: string): TokenValue => ({ kind: "length", value, unit });

describe("buildTokenSystem", () => {
  it("orders sets by $metadata, then sets a theme names, then other files by path", () => {
    const files = new Map<string, unknown>([
      ["b.json", {}],
      ["a.json", {}],
      ["z/one.json", {}],
      ["named.json", {}],
      ["$metadata.json", { tokenSetOrder: ["b"] }],
      ["$themes.json", [{ id: "1", name: "x", selectedTokenSets: { named: "enabled" } }]],
    ]);
    const { system: s, problems } = buildTokenSystem(files);
    expect(s.order).toEqual(["b", "named", "a", "z/one"]);
    expect(s.themes[0].group).toBe("Ungrouped");
    expect(problems).toEqual([]);
  });

  it("reports a set that is named but has no file, and skips $ and dot files", () => {
    const files = new Map<string, unknown>([
      ["a.json", {}],
      [".hidden/x.json", {}],
      ["$extra.json", {}],
      ["$metadata.json", { tokenSetOrder: ["a", "gone"] }],
    ]);
    const { system: s, problems } = buildTokenSystem(files);
    expect(s.order).toEqual(["a"]);
    expect(s.themes).toEqual([]);
    expect(problems).toEqual([{ kind: "missing-set", set: "gone" }]);
  });

  it("reads the synthetic fixture", () => {
    const { system: s, problems } = buildTokenSystem(readFixture());
    expect(problems).toEqual([]);
    expect(s.order[0]).toBe("Foundation/Helpers");
    expect(s.themes.length).toBeGreaterThan(5);
  });
});

describe("compose", () => {
  it("merges groups, and a later token replaces an earlier one whole", () => {
    const s = system({
      base: { g: { a: tok("color", "#000", { $description: "base" }), b: tok("color", "#111") } },
      over: { g: { a: tok("color", "#fff"), c: tok("color", "#222") } },
    });
    const d = compose(s, [
      { set: "base", state: "source" },
      { set: "over", state: "enabled" },
    ]);
    expect(d.entries.map((e) => e.key)).toEqual(["g.a", "g.b", "g.c"]);
    expect(d.byKey.get("g.a")).toMatchObject({ value: "#fff", set: "over", emitted: true });
    expect(d.byKey.get("g.a")!.description).toBeUndefined();
    expect(d.byKey.get("g.b")).toMatchObject({ set: "base", emitted: false });
    expect(d.groups).toEqual(new Set(["g"]));
  });

  it("reads source sets before enabled sets, whatever the list order", () => {
    const s = system({ x: { a: tok("number", 1) }, y: { a: tok("number", 2) } });
    const d = compose(s, [
      { set: "x", state: "enabled" },
      { set: "y", state: "source" },
    ]);
    expect(d.byKey.get("a")).toMatchObject({ value: 1, emitted: true });
  });

  it("keeps the order of the selection, also for set names that look like integers", () => {
    const s = system({ "2": { a: tok("number", 2) }, "1": { a: tok("number", 1) } });
    const d = compose(s, [
      { set: "2", state: "enabled" },
      { set: "1", state: "enabled" },
    ]);
    expect(d.byKey.get("a")!.value).toBe(1);
  });

  it("lets a group's $type reach tokens of other sets in the merged tree", () => {
    const s = system({
      types: { space: { $type: "spacing", s: tok(undefined, "4") } },
      over: { space: { s: tok(undefined, "8"), own: tok("sizing", "2") } },
    });
    const d = compose(s, [
      { set: "types", state: "source" },
      { set: "over", state: "enabled" },
    ]);
    expect(d.byKey.get("space.s")).toMatchObject({ type: "spacing", alignedType: "dimension", set: "over" });
    expect(d.byKey.get("space.own")!.type).toBe("sizing");
    expect(d.problems).toEqual([]);
  });

  it("keeps an untyped token and reports it", () => {
    const d = compose(system({ a: { n: tok(undefined, 3), t: tok(undefined, "x"), o: tok(undefined, { a: 1 }) } }), [{ set: "a", state: "enabled" }]);
    expect(d.entries.map((e) => e.key)).toEqual(["n", "t", "o"]);
    expect(d.problems).toEqual([
      { kind: "untyped-token", path: "n", set: "a" },
      { kind: "untyped-token", path: "t", set: "a" },
      { kind: "untyped-token", path: "o", set: "a" },
    ]);
    const { values } = resolveDictionary(d);
    expect(values.get("n")!.value).toEqual({ kind: "number", value: 3 });
    expect(values.get("t")!.value).toEqual({ kind: "string", value: "x" });
    expect(values.get("o")!.value).toEqual({ kind: "raw", value: { a: 1 } });
    expect(values.get("n")!.problems).toEqual([{ kind: "untyped-token", path: "n", set: "a" }]);
  });

  it("reports a token replacing a group and the reverse", () => {
    const s = system({ x: { a: { b: tok("number", 1) }, c: tok("number", 1) }, y: { a: tok("number", 2), c: { d: tok("number", 3) } } });
    const d = compose(s, [
      { set: "x", state: "enabled" },
      { set: "y", state: "enabled" },
    ]);
    expect(d.entries.map((e) => e.key)).toEqual(["a", "c.d"]);
    expect(d.problems).toEqual([
      { kind: "node-conflict", path: "a", set: "y" },
      { kind: "node-conflict", path: "c", set: "y" },
    ]);
  });

  it("composes a theme by id or definition and fails for an unknown id", () => {
    const s = system({ a: { n: tok("number", 1) } });
    expect(composeTheme(s, "t/t").byKey.get("n")!.emitted).toBe(true);
    expect(composeTheme(s, s.themes[0]).entries).toHaveLength(1);
    expect(() => composeTheme(s, "t/none")).toThrow(/no theme/);
  });
});

describe("values mean what their type says, not how they were reached", () => {
  it("a bare number in a length type is px; other units stay as written", () => {
    expect(valueOf({ a: tok("spacing", "8") }, "a")).toEqual(length(8, "px"));
    expect(valueOf({ a: tok("fontSizes", 14) }, "a")).toEqual(length(14, "px"));
    expect(valueOf({ a: tok("dimension", "0.5rem") }, "a")).toEqual(length(0.5, "rem"));
    expect(valueOf({ a: tok("sizing", "60ch") }, "a")).toEqual(length(60, "ch"));
    expect(valueOf({ a: tok("sizing", "100%") }, "a")).toEqual(length(100, "%"));
  });

  it("a reference and a literal of the same length are the same value", () => {
    const tokens = { dimension: { "5x": tok("dimension", "20px") }, ref: tok("fontSizes", "{dimension.5x}"), lit: tok("fontSizes", "20px"), num: tok("number", 20), viaNum: tok("spacing", "{num}") };
    expect(valueOf(tokens, "ref")).toEqual(length(20, "px"));
    expect(valueOf(tokens, "lit")).toEqual(length(20, "px"));
    expect(valueOf(tokens, "viaNum")).toEqual(length(20, "px"));
  });

  it("percent: em in letterSpacing, a factor in lineHeights and opacity, text elsewhere", () => {
    const tokens = { ls: tok("letterSpacing", "-3%"), lh: tok("lineHeights", "150%"), lhpx: tok("lineHeights", "20px"), op: tok("opacity", "8%"), n: tok("number", "93%"), lsRef: tok("letterSpacing", "{other}"), other: tok("other", "-5%") };
    expect(valueOf(tokens, "ls")).toEqual(length(-0.03, "em"));
    expect(valueOf(tokens, "lh")).toEqual({ kind: "number", value: 1.5 });
    expect(valueOf(tokens, "lhpx")).toEqual(length(20, "px"));
    expect(valueOf(tokens, "op")).toEqual({ kind: "number", value: 0.08 });
    expect(valueOf(tokens, "n")).toEqual({ kind: "string", value: "93%" });
    expect(valueOf(tokens, "lsRef")).toEqual(length(-0.05, "em"));
  });

  it("font weights by name, with style; an unknown name is reported", () => {
    expect(valueOf({ a: tok("fontWeights", "SemiBold") }, "a")).toEqual({ kind: "fontWeight", value: 600 });
    expect(valueOf({ a: tok("fontWeights", "Bold Italic") }, "a")).toEqual({ kind: "fontWeight", value: 700, style: "italic" });
    expect(valueOf({ a: tok("fontWeights", 300) }, "a")).toEqual({ kind: "fontWeight", value: 300 });
    const r = resolveToken(compose(system({ a: { w: tok("fontWeights", "Chunky") } }), [{ set: "a", state: "enabled" }]), "w");
    expect(r.value).toEqual({ kind: "string", value: "Chunky" });
    expect(r.problems).toEqual([{ kind: "invalid-value", path: "w", type: "fontWeights", value: "Chunky", reason: "unknown font weight" }]);
  });

  it("font families as a list, durations, easings", () => {
    expect(valueOf({ a: tok("fontFamilies", "Inter, 'Helvetica Neue', sans-serif") }, "a")).toEqual({ kind: "fontFamily", families: ["Inter", "Helvetica Neue", "sans-serif"] });
    expect(valueOf({ a: tok("duration", "200ms") }, "a")).toEqual({ kind: "duration", value: 200, unit: "ms" });
    expect(valueOf({ a: tok("duration", "0.2s") }, "a")).toEqual({ kind: "duration", value: 0.2, unit: "s" });
    expect(valueOf({ a: tok("cubicBezier", [0.2, 0, 0, 1]) }, "a")).toEqual({ kind: "cubicBezier", points: [0.2, 0, 0, 1] });
    expect(valueOf({ a: tok("cubicBezier", "cubic-bezier(0.4, 0, 1, 1)") }, "a")).toEqual({ kind: "cubicBezier", points: [0.4, 0, 1, 1] });
    expect(valueOf({ a: tok("cubicBezier", "ease-in") }, "a")).toEqual({ kind: "string", value: "ease-in" });
    const r = resolveToken(compose(system({ a: { e: tok("cubicBezier", [0.2, 0, 1]) } }), [{ set: "a", state: "enabled" }]), "e");
    expect(r.value.kind).toBe("string");
    expect(r.problems[0]).toMatchObject({ kind: "invalid-value", reason: "cubic-bezier needs four numbers" });
  });
});

describe("arrays and DTCG objects outside composites", () => {
  it("resolves references in a font family list and a bezier array", () => {
    const tokens = {
      font: { primary: tok("fontFamilies", "Inter, Helvetica") },
      stack: tok("fontFamilies", ["{font.primary}", "sans-serif"]),
      p: tok("number", "0.2"),
      ease: tok("cubicBezier", ["{p}", 0, 0, 1]),
      broken: tok("cubicBezier", ["{nope}", 0, 0, 1]),
    };
    expect(valueOf(tokens, "stack")).toEqual({ kind: "fontFamily", families: ["Inter", "Helvetica", "sans-serif"] });
    expect(valueOf(tokens, "ease")).toEqual({ kind: "cubicBezier", points: [0.2, 0, 0, 1] });
    expect(valueOf(tokens, "broken")).toEqual({ kind: "unresolved", text: "{nope}, 0, 0, 1" });
  });

  it("reads DTCG `{ value, unit }` as length and duration", () => {
    expect(valueOf({ a: tok("dimension", { value: 8, unit: "px" }) }, "a")).toEqual(length(8, "px"));
    expect(valueOf({ a: tok("fontSizes", { value: 1.5, unit: "rem" }) }, "a")).toEqual(length(1.5, "rem"));
    expect(valueOf({ a: tok("duration", { value: 200, unit: "ms" }) }, "a")).toEqual({ kind: "duration", value: 200, unit: "ms" });
    expect(valueOf({ a: tok("other", { value: 8, unit: "px" }) }, "a")).toEqual({ kind: "raw", value: { value: 8, unit: "px" } });
  });
});

describe("arithmetic", () => {
  it("reduces with units and without rounding", () => {
    const tokens = { base: tok("dimension", "8px"), twice: tok("dimension", "{base} * 2"), third: tok("number", "10 / 3"), sum: tok("dimension", "16px + 4"), ratio: tok("number", "{base} / 4px") };
    expect(valueOf(tokens, "twice")).toEqual(length(16, "px"));
    expect(valueOf(tokens, "third")).toEqual({ kind: "number", value: 10 / 3 });
    expect(valueOf(tokens, "sum")).toEqual(length(20, "px"));
    expect(valueOf(tokens, "ratio")).toEqual({ kind: "number", value: 2 });
  });

  it("keeps what cannot be reduced as an expression", () => {
    expect(valueOf({ a: tok("dimension", "80rem - 1px") }, "a")).toEqual({
      kind: "expression",
      expr: { op: "-", left: length(80, "rem"), right: length(1, "px") },
    });
  });

  it("reads space-separated values as a list, a glued minus as a new item", () => {
    expect(valueOf({ a: tok("spacing", "0 4px 8") }, "a")).toEqual({ kind: "list", items: [length(0, "px"), length(4, "px"), length(8, "px")] });
    expect(valueOf({ a: tok("spacing", "0 -4px") }, "a")).toEqual({ kind: "list", items: [length(0, "px"), length(-4, "px")] });
    expect(valueOf({ a: tok("spacing", "8 - 4") }, "a")).toEqual(length(4, "px"));
  });
});

describe("references", () => {
  it("accepts `.$value` and whitespace inside the braces", () => {
    const tokens = { a: tok("number", 3), b: tok("number", "{ a.$value }"), c: tok("number", "{a}") };
    expect(valueOf(tokens, "b")).toEqual({ kind: "number", value: 3 });
    expect(referencesIn({ x: ["{ a.$value }", "{b} + {c.d}"] })).toEqual(["a", "b", "c.d"]);
  });

  it("reports a reference to nothing and to a group; the text stays", () => {
    const d = compose(system({ a: { g: { x: tok("number", 1) }, bad: tok("number", "{nope}"), grp: tok("number", "{g}"), half: tok("number", "{nope} * 2") } }), [{ set: "a", state: "enabled" }]);
    const { values, problems } = resolveDictionary(d);
    expect(values.get("bad")!.value).toEqual({ kind: "unresolved", text: "{nope}" });
    expect(values.get("half")!.value).toEqual({ kind: "unresolved", text: "{nope} * 2" });
    expect(problems).toEqual([
      { kind: "unknown-reference", path: "bad", reference: "nope" },
      { kind: "group-reference", path: "grp", reference: "g" },
      { kind: "unknown-reference", path: "half", reference: "nope" },
    ]);
  });

  it("reports a cycle with its path instead of dropping the value", () => {
    const d = compose(system({ a: { x: tok("number", "{y}"), y: tok("number", "{z}"), z: tok("number", "{x}") } }), [{ set: "a", state: "enabled" }]);
    const r = resolveToken(d, "x");
    expect(r.value).toEqual({ kind: "unresolved", text: "{y}" });
    expect(r.problems).toEqual([{ kind: "cycle", path: "z", cycle: ["x", "y", "z", "x"] }]);
    expect(resolveDictionary(d).problems).toHaveLength(1);
  });

  it("keeps the chain: every visited token with set and written value, once", () => {
    const s = system({
      base: { c: tok("color", "#336699"), amt: tok("number", "0.5") },
      top: { mid: tok("color", "{c}"), end: tok("color", "{mid}", { $extensions: { "studio.tokens": { modify: { type: "alpha", value: "{amt}", space: "srgb" } } } }) },
    });
    const r = resolveToken(composeTheme(s, "t/t"), "end");
    expect(r.chain).toEqual([
      { key: "end", set: "top", value: "{mid}", modify: { type: "alpha", value: "{amt}", space: "srgb" } },
      { key: "mid", set: "top", value: "{c}" },
      { key: "c", set: "base", value: "#336699" },
      { key: "amt", set: "base", value: "0.5" },
    ]);
    expect(r.value).toMatchObject({ kind: "color", color: { alpha: 0.5 } });
    expect(r.value).not.toHaveProperty("literal");
  });
});

describe("colours", () => {
  it("keeps the literal and parses it; lch() with references is a colour", () => {
    const tokens = { l: tok("number", "62"), c: tok("number", "{cc} * 0.5"), cc: tok("number", 144), x: tok("color", "lch({l} {c} 250)") };
    const v = valueOf(tokens, "x");
    expect(v).toMatchObject({ kind: "color", literal: "lch(62 72 250)", color: { mode: "lch", l: 62, c: 72, h: 250 }, outOfGamut: true });
    expect(valueOf({ a: tok("color", "#fff") }, "a")).toMatchObject({ literal: "#fff", outOfGamut: false });
  });

  it("keeps a colour culori cannot read as its literal", () => {
    expect(valueOf({ a: tok("color", "linear-gradient(red, blue)") }, "a")).toEqual({ kind: "color", literal: "linear-gradient(red, blue)" });
  });

  it("reads rgba(<colour>, alpha), also with a reference and inside composites", () => {
    const tokens = {
      base: tok("color", "#336699"),
      hex: tok("color", "rgba(#336699, 0.5)"),
      ref: tok("color", "rgba({base}, 50%)"),
      shadow: tok("boxShadow", [{ x: "0", y: "2", blur: "4", spread: "0", color: "rgba({base}, 0.25)", type: "innerShadow" }]),
      border: tok("border", { width: "1", style: "solid", color: "rgba(#000, 0.1)" }),
    };
    expect(valueOf(tokens, "hex")).toMatchObject({ kind: "color", literal: "rgba(#336699, 0.5)", color: { mode: "rgb", alpha: 0.5 } });
    expect(valueOf(tokens, "ref")).toMatchObject({ kind: "color", literal: "rgba(#336699, 50%)", color: { alpha: 0.5 } });
    const shadow = valueOf(tokens, "shadow");
    expect(shadow).toMatchObject({ kind: "shadow", layers: [{ inset: true, offsetX: length(0, "px"), offsetY: length(2, "px"), blur: length(4, "px"), color: { kind: "color", color: { alpha: 0.25 } } }] });
    expect(valueOf(tokens, "border")).toMatchObject({ kind: "border", width: length(1, "px"), style: { kind: "string", value: "solid" }, color: { color: { alpha: 0.1 } } });
  });

  it("a computed colour embedded in text is hex, with alpha as 8 digits", () => {
    const tokens = {
      c: tok("color", "#336699", { $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } } }),
      text: tok("text", "border: {c}"),
    };
    expect(valueOf(tokens, "text")).toEqual({ kind: "string", value: "border: #33669980" });
  });

  it("a modifier works on the gamut-mapped base, whether or not the base was computed", () => {
    const darken = { $extensions: { "studio.tokens": { modify: { type: "darken", value: "0.2", space: "lch" } } } };
    const tokens = {
      wide: tok("color", "lch(62 72 250)"),
      computed: tok("color", "lch(62 72 250)", { $extensions: { "studio.tokens": { modify: { type: "lighten", value: "0", space: "lch" } } } }),
      dark: tok("color", "{wide}", darken),
      darkOfComputed: tok("color", "{computed}", darken),
    };
    const v = valueOf(tokens, "dark");
    expect(v).toMatchObject({ kind: "color", outOfGamut: false });
    expect(v).not.toHaveProperty("literal");
    expect(textOf(v)).toBe("#1a81b5");
    expect(textOf(valueOf(tokens, "darkOfComputed"))).toBe("#1a81b5");
  });
});

describe("cssColor", () => {
  it("writes a colour as rgb(), hex or percentages, gamut-mapped", () => {
    const c = { mode: "rgb", r: 0.2, g: 0.4, b: 0.6, alpha: 0.5 };
    expect(cssColor(c, "rgb")).toBe("rgba(51, 102, 153, 0.5)");
    expect(cssColor(c, "hex")).toBe("#33669980");
    expect(cssColor(c, "percent")).toBe("rgb(20% 40% 60% / 0.5)");
    expect(cssColor({ mode: "lch", l: 62, c: 72, h: 250 }, "rgb")).toBe("rgb(0, 165, 233)");
  });

  it("takes a channel within float noise of the edge as the edge", () => {
    expect(cssColor({ mode: "rgb", r: 0.000002, g: 0.5, b: 1.0000001 }, "percent")).toBe("rgb(0% 50% 100%)");
  });
});

describe("composites", () => {
  it("typography reads each property under its own type", () => {
    const tokens = {
      fs: tok("fontSizes", "16"),
      typo: tok("typography", { fontFamily: "Inter", fontWeight: "Bold", fontSize: "{fs}", lineHeight: "150%", letterSpacing: "-1%", textCase: "uppercase" }),
    };
    expect(valueOf(tokens, "typo")).toEqual({
      kind: "typography",
      fontFamily: { kind: "fontFamily", families: ["Inter"] },
      fontWeight: { kind: "fontWeight", value: 700 },
      fontSize: length(16, "px"),
      lineHeight: { kind: "number", value: 1.5 },
      letterSpacing: length(-0.01, "em"),
      textCase: { kind: "string", value: "uppercase" },
    });
  });

  it("a composite that is one reference takes the target composite", () => {
    const tokens = { s: tok("boxShadow", { x: 0, y: 1, blur: 2, spread: 0, color: "#000" }), card: tok("boxShadow", "{s}") };
    expect(valueOf(tokens, "card")).toEqual(valueOf(tokens, "s"));
  });

  it("transition", () => {
    expect(valueOf({ t: tok("transition", { duration: "200ms", delay: "0ms", timingFunction: [0, 0, 1, 1] }) }, "t")).toEqual({
      kind: "transition",
      duration: { kind: "duration", value: 200, unit: "ms" },
      delay: { kind: "duration", value: 0, unit: "ms" },
      timingFunction: { kind: "cubicBezier", points: [0, 0, 1, 1] },
    });
  });
});

describe("the synthetic fixture", () => {
  it("resolves every theme without problems", () => {
    const { system: s } = buildTokenSystem(readFixture());
    for (const theme of s.themes) {
      expect(resolveDictionary(composeTheme(s, theme)).problems, `${theme.group}/${theme.name}`).toEqual([]);
    }
  });
});
