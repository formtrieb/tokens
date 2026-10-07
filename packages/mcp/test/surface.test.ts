/** The tool surface of 3.0: typed values, problems, defaults, types from the data. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _clearCacheForTesting } from "../src/token-context.js";
import { setupTools } from "./mock-server.js";

const STUDIO = fileURLToPath(new URL("./fixtures/tokens-studio", import.meta.url));
const MISSING = fileURLToPath(new URL("./fixtures/edge-cases/missing-set", import.meta.url));

let root: string;

/** A one-theme system: set `base` enabled in theme `T/T`. */
function system(base: Record<string, unknown>) {
  writeFileSync(join(root, "$metadata.json"), JSON.stringify({ tokenSetOrder: ["base"] }));
  writeFileSync(join(root, "$themes.json"), JSON.stringify([{ id: "t", name: "T", group: "T", selectedTokenSets: { base: "enabled" } }]));
  writeFileSync(join(root, "base.json"), JSON.stringify(base));
  return root;
}

beforeEach(() => {
  _clearCacheForTesting();
  root = mkdtempSync(join(tmpdir(), "tokens-surface-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("resolve_token", () => {
  it("returns the type, the typed value, the display and the chain", async () => {
    const out = await setupTools().callTool("resolve_token", { tokens_path: STUDIO, path: "color.accent" });
    expect(out.type).toBe("color");
    expect(out.finalValue).toBe("#3b82f6");
    expect(out.value).toMatchObject({ kind: "color", literal: "#3b82f6" });
    expect(out.chain).toEqual([
      { tokenPath: "color.accent", rawValue: "{color.blue.500}", sourceSet: "Light" },
      { tokenPath: "color.blue.500", rawValue: "#3b82f6", sourceSet: "Foundation" },
    ]);
    expect(out.problems).toBeUndefined();
  });

  it("reduces math and sees a group's $type", async () => {
    const path = system({ space: { $type: "dimension", base: { $value: "8px" }, double: { $value: "{space.base} * 2" } } });
    const out = await setupTools().callTool("resolve_token", { tokens_path: path, path: "space.double" });
    expect(out.type).toBe("dimension");
    expect(out.finalValue).toBe("16px");
    expect(out.value).toEqual({ kind: "length", value: 16, unit: "px" });
  });

  it("reports a cycle and an unknown path as problems", async () => {
    const path = system({ a: { $type: "number", $value: "{b}" }, b: { $type: "number", $value: "{a}" } });
    const m = setupTools();
    const cycle = await m.callTool("resolve_token", { tokens_path: path, path: "a" });
    expect(cycle.value).toEqual({ kind: "unresolved", text: "{b}" });
    expect(cycle.problems).toEqual([
      { kind: "cycle", path: "b", cycle: ["a", "b", "a"] },
      // render would refuse to write the value
      { kind: "invalid-css", path: "a", reason: "unresolved reference {b}" },
    ]);
    const unknown = await m.callTool("resolve_token", { tokens_path: path, path: "nope" });
    expect(unknown.finalValue).toBeNull();
    expect(unknown.problems).toEqual([{ kind: "unknown-reference", path: "nope", reference: "nope" }]);
  });

  it("shows a computed colour as render writes it; format picks the form", async () => {
    const path = system({
      ink: { $type: "color", $value: "#336699" },
      soft: { $type: "color", $value: "{ink}", $extensions: { "studio.tokens": { modify: { type: "alpha", value: "0.5", space: "srgb" } } } },
    });
    const m = setupTools();
    const at = async (format?: string) => (await m.callTool("resolve_token", { tokens_path: path, path: "soft", ...(format && { format }) })).finalValue;
    expect(await at()).toBe("rgb(20% 40% 60% / 0.5)");
    // as render writes it: under rgb a computed colour keeps its rgb(r% g% b% / a)
    expect(await at("rgb")).toBe("rgb(20% 40% 60% / 0.5)");
    expect(await at("rgba")).toBe("rgb(20% 40% 60% / 0.5)");
    expect((await m.callTool("resolve_token", { tokens_path: path, path: "ink", format: "rgb" })).finalValue).toBe("rgb(51, 102, 153)");
    expect(await at("hex")).toBe("#33669980");
  });
});

describe("resolve_batch", () => {
  it("adds the typed value and chain only with verbose", async () => {
    const m = setupTools();
    const plain = (await m.callTool("resolve_batch", { tokens_path: STUDIO, paths: ["color.accent"] })).results as Record<string, Record<string, unknown>>;
    expect(plain["color.accent"]).toEqual({ finalValue: "#3b82f6", type: "color", steps: 2 });
    const verbose = (await m.callTool("resolve_batch", { tokens_path: STUDIO, paths: ["color.accent"], verbose: true })).results as Record<string, Record<string, unknown>>;
    expect(verbose["color.accent"]!.value).toMatchObject({ kind: "color" });
    expect(verbose["color.accent"]!.chain).toHaveLength(2);
  });
});

describe("path_prefix", () => {
  it("stops at a dot boundary in browse_tokens and compare_themes", async () => {
    const path = system({ color: { text: { $type: "color", $value: "#000" }, textual: { $type: "color", $value: "#111" } } });
    const m = setupTools();
    const tree = (await m.callTool("browse_tokens", { tokens_path: path, path_prefix: "color.text", depth: 3 })).count;
    expect(tree).toBe(1);
  });
});

describe("theme defaults", () => {
  it("compare_themes fills a missing axis with its default", async () => {
    const out = await setupTools().callTool("compare_themes", { tokens_path: STUDIO, theme_a: {}, theme_b: { Theme: "Dark" } });
    expect(out.theme_a).toEqual({ Theme: "Light" });
    expect(out.changed).toEqual([
      { path: "color.background", valueA: "#f5f5f5", valueB: "#171717" },
      { path: "color.foreground", valueA: "#171717", valueB: "#f5f5f5" },
    ]);
  });
});

describe("token types come from the loaded system", () => {
  it("filters by a type a group gives, and rejects a type the system does not use", async () => {
    const path = system({ space: { $type: "spacing", s: { $value: "4" } }, ink: { $type: "color", $value: "#000" } });
    const m = setupTools();
    const out = await m.callTool("search_tokens", { tokens_path: path, query: "s", type: "spacing" });
    expect((out.results as { path: string }[]).map((r) => r.path)).toEqual(["space.s"]);
    await expect(m.callTool("browse_tokens", { tokens_path: path, type: "Spacing" })).rejects.toThrow(/did you mean "spacing"/);
    await expect(m.callTool("search_tokens", { tokens_path: path, query: "s", type: "fontSizes" })).rejects.toThrow(/Types in this token system: color, spacing/);
  });
});

describe("loading problems", () => {
  it("list_token_sets names a set that has no file", async () => {
    const out = await setupTools().callTool("list_token_sets", { tokens_path: MISSING });
    expect(out.order).toEqual(["Real"]);
    expect(out.problems).toEqual([{ kind: "missing-set", set: "Ghost" }]);
  });
});
