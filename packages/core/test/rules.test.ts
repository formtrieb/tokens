import { describe, expect, it } from "vitest";
import { checkRules, matchPath, parseRules, type DesignRules, type DictionaryEntry } from "../src/index.js";

const e = (key: string, value: unknown, set = "base"): DictionaryEntry => ({ key, path: key.split("."), value, set, emitted: true, type: "color" });
const check = (rules: DesignRules["rules"], entries: DictionaryEntry[]) =>
  checkRules(entries, parseRules({ rules })).map((v) => `${v.rule} ${v.path} ${v.severity}: ${v.actual}`);

describe("matchPath", () => {
  it("matches segments: * one, ** zero or more", () => {
    expect(matchPath(["a", "*"], ["a", "b"])).toBe(true);
    expect(matchPath(["a", "*"], ["a", "b", "c"])).toBe(false);
    expect(matchPath(["a", "**"], ["a"])).toBe(true);
    expect(matchPath(["**", "c"], ["a", "b", "c"])).toBe(true);
    expect(matchPath(["Components", "**"], "Components/Button".split("/"))).toBe(true);
  });
});

describe("checkRules", () => {
  const entries = [
    e("ui.icon.default", "{palette.icon.a}"),
    e("ui.icon.hover", "{palette.text.a}"),
    e("ui.icon.pressed", "{ui.icon.default}"),
    e("card.bg", "{palette.raw.a}", "Components/Card"),
    e("a.b.c.d", "1"),
  ];

  it("references: within limits what is checked, allow and deny judge it", () => {
    expect(check([{ rule: "icons", kind: "references", tokens: ["ui.icon.*"], within: ["palette.**"], allow: ["palette.icon.**"] }], entries)).toEqual([
      "icons ui.icon.hover warning: References palette.text.a",
    ]);
    expect(check([{ rule: "raw", kind: "references", sets: ["Components/**"], deny: ["palette.raw.**"], severity: "info" }], entries)).toEqual([
      "raw card.bg info: References palette.raw.a directly",
    ]);
  });

  it("segments, depth and sibling references", () => {
    expect(check([{ rule: "states", kind: "segments", tokens: ["ui.*.*"], segments: [{ index: 2, name: "state", values: ["default", "hover"] }] }], entries)).toEqual([
      "states ui.icon.pressed warning: Uses \"pressed\"",
    ]);
    expect(check([{ rule: "deep", kind: "depth", max: 3 }], entries)).toEqual(["deep a.b.c.d warning: 4 segments"]);
    expect(check([{ rule: "sib", kind: "sibling-reference" }], entries)).toEqual(["sib ui.icon.pressed warning: References sibling ui.icon.default"]);
  });

  it("uses the rule's expected text when given", () => {
    const out = checkRules(entries, parseRules({ rules: [{ rule: "d", kind: "depth", max: 3, expected: "flat paths" }] }));
    expect(out[0]!.expected).toBe("flat paths");
  });
});

describe("parseRules", () => {
  it("names the broken field", () => {
    expect(() => parseRules({})).toThrow(/expected \{ rules/);
    expect(() => parseRules({ rules: [{ kind: "depth", max: 2 }] })).toThrow(/rules\[0\]\.rule/);
    expect(() => parseRules({ rules: [{ rule: "x", kind: "odd" }] })).toThrow(/rules\[0\]\.kind/);
    expect(() => parseRules({ rules: [{ rule: "x", kind: "depth", max: 0 }] })).toThrow(/rules\[0\]\.max/);
    expect(() => parseRules({ rules: [{ rule: "x", kind: "depth", max: 2, severity: "fatal" }] })).toThrow(/severity/);
    expect(() => parseRules({ rules: [{ rule: "x", kind: "references", allow: ["a..b"] }] }, "f.json")).toThrow(/^f\.json: rules\[0\]\.allow/);
    expect(() => parseRules({ rules: [{ rule: "x", kind: "segments", segments: [{ index: -1, values: [] }] }] })).toThrow(/segments\[0\]\.index/);
  });
});
