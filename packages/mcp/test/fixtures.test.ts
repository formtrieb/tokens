import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildAxisMap, buildTokenSystem, getDefaultAxes } from "@formtrieb/tokens-core";
import { readTokenFiles } from "../src/loader/token-loader.js";
import { selectionFor } from "../src/composition.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (path: string) => buildTokenSystem(readTokenFiles(path));

describe("fixture: tokens-studio/", () => {
  const path = join(fixturesDir, "tokens-studio");

  it("loads metadata + all 3 sets without problems", () => {
    const { system, problems } = load(path);
    expect(system.order).toEqual(["Foundation", "Light", "Dark"]);
    expect(system.sets.size).toBe(3);
    expect(problems).toEqual([]);
  });

  it("has a Theme axis with Light + Dark, Light the default", () => {
    const axes = buildAxisMap(load(path).system.themes);
    expect([...axes.keys()]).toEqual(["Theme"]);
    expect(axes.get("Theme")!.map((t) => t.name)).toEqual(["Light", "Dark"]);
    expect(getDefaultAxes(axes)).toEqual({ Theme: "Light" });
  });

  it("selects Foundation as source, Light/Dark as enabled", () => {
    const { system } = load(path);
    expect(selectionFor(system, { Theme: "Light" })).toEqual([
      { set: "Foundation", state: "source" },
      { set: "Light", state: "enabled" },
    ]);
    expect(selectionFor(system, { Theme: "Dark" })).toEqual([
      { set: "Foundation", state: "source" },
      { set: "Dark", state: "enabled" },
    ]);
  });
});

describe("fixture: edge-cases/circular-refs/", () => {
  const path = join(fixturesDir, "edge-cases", "circular-refs");

  it("loads the circular set without resolving, and no themes", () => {
    const { system } = load(path);
    expect(system.order).toEqual(["circular"]);
    expect(system.sets.get("circular")).toBeDefined();
    expect(system.themes).toEqual([]);
  });
});

describe("fixture: edge-cases/missing-set/", () => {
  const path = join(fixturesDir, "edge-cases", "missing-set");

  it("loads Real and reports Ghost, which has no file", () => {
    const { system, problems } = load(path);
    expect(system.order).toEqual(["Real"]);
    expect(system.sets.has("Ghost")).toBe(false);
    expect(problems).toEqual([{ kind: "missing-set", set: "Ghost" }]);
  });

  it("keeps Ghost in the theme's selection; composing it reports the missing set", () => {
    const { system } = load(path);
    expect(selectionFor(system, { Theme: "Default" })).toEqual([
      { set: "Real", state: "enabled" },
      { set: "Ghost", state: "enabled" },
    ]);
  });
});

describe("fixture: edge-cases/empty/", () => {
  const path = join(fixturesDir, "edge-cases", "empty");

  it("handles an empty token set order and no themes", () => {
    const { system, problems } = load(path);
    expect(system.order).toEqual([]);
    expect(system.sets.size).toBe(0);
    expect(getDefaultAxes(buildAxisMap(system.themes))).toEqual({});
    expect(problems).toEqual([]);
  });
});
