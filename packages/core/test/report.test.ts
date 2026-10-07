import { describe, expect, it } from "vitest";
import { designReport, parseRules, type DictionaryEntry } from "../src/index.js";

const e = (key: string, value: unknown, set = "base", type = "color"): DictionaryEntry => ({ key, path: key.split("."), value, set, emitted: true, type });

describe("designReport", () => {
  const entries = [e("a.b.c.d", "1"), e("x.y", "{nope}")];
  const rules = parseRules({ rules: [{ rule: "deep", kind: "depth", max: 3, severity: "error" }, { rule: "note", kind: "depth", max: 1, severity: "info" }] });
  const resolution = [{ scope: "G/T", problems: [
    { kind: "unknown-reference" as const, path: "x.y", reference: "nope" },
    { kind: "unknown-reference" as const, path: "x.y", reference: "nope" },
    { kind: "untyped-token" as const, path: "u", set: "base" },
  ] }];

  it("counts rule and resolution findings together, broken references apart", () => {
    const r = designReport({ entries, rules, resolution });
    expect(r.summary).toEqual({ errors: 2, warnings: 1, info: 0, brokenReferences: 1, resolution: 2 });
    expect(r.byRule.deep).toMatchObject({ count: 1, severity: "error", affected: ["a.b.c"] });
    expect(r.byRule.note).toBeUndefined();
    expect(r.resolution.problems.map((p) => `${p.theme} ${p.severity} ${p.kind}`)).toEqual(["G/T error unknown-reference", "G/T warning untyped-token"]);
    expect(r.parity).toBe("not checked");
  });

  it("lets info in with severity info and keeps warnings out with severity error", () => {
    expect(designReport({ entries, rules, resolution, severity: "info" }).summary.info).toBe(2);
    expect(designReport({ entries, rules, resolution, severity: "error" }).summary).toMatchObject({ errors: 2, warnings: 0 });
  });

  it("compares the themes of an axis, the first against the others", () => {
    const r = designReport({
      entries: [],
      parity: { axis: "Mode", themes: [{ name: "Light", entries: [e("c.a", "#000")] }, { name: "Dark", entries: [e("c.a", "#fff"), e("c.b", "#111")] }] },
    });
    expect(r.parity).toEqual({ axis: "Mode", base: "Light", against: { Dark: { identical: false, missingInBase: ["c.b"] } } });
  });
});
