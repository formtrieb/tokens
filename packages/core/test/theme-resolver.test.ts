import { describe, it, expect } from "vitest";
import {
  parseThemes,
  buildAxisMap,
  getDefaultAxes,
  getAxisGroups,
  describeAxes,
  validateAxes,
  UNGROUPED_AXIS,
} from "../src/theme/theme-resolver.js";
import type { RawTheme } from "../src/theme/theme-resolver.js";

/** Foreign DS shape: axes that are not Semantic/Device/Shape. */
const FOREIGN: RawTheme[] = [
  {
    id: "brand-acme",
    name: "Acme",
    group: "Brand",
    selectedTokenSets: { core: "source", "brand/acme": "enabled" },
  },
  {
    id: "brand-globex",
    name: "Globex",
    group: "Brand",
    selectedTokenSets: { core: "source", "brand/globex": "enabled" },
  },
  {
    id: "density-cozy",
    name: "Cozy",
    group: "Density",
    selectedTokenSets: { "density/cozy": "enabled" },
  },
];

/** Themes without a `group` key — the `"undefined"` axis reported in FOR-369. */
const UNGROUPED: RawTheme[] = [
  { id: "t-light", name: "Light", selectedTokenSets: { light: "enabled" } },
  { id: "t-dark", name: "Dark", selectedTokenSets: { dark: "enabled" } },
];

describe("parseThemes", () => {
  it("keeps an explicit group", () => {
    expect(parseThemes(FOREIGN).map((t) => t.group)).toEqual([
      "Brand",
      "Brand",
      "Density",
    ]);
  });

  it("assigns the ungrouped collector axis when group is missing", () => {
    expect(parseThemes(UNGROUPED).map((t) => t.group)).toEqual([
      UNGROUPED_AXIS,
      UNGROUPED_AXIS,
    ]);
  });

  it("treats a blank group as missing", () => {
    const parsed = parseThemes([
      { id: "a", name: "A", group: "   ", selectedTokenSets: {} },
    ]);
    expect(parsed[0]!.group).toBe(UNGROUPED_AXIS);
  });
});

describe("buildAxisMap", () => {
  it("groups foreign axes by their own names", () => {
    const map = buildAxisMap(parseThemes(FOREIGN));
    expect([...map.keys()]).toEqual(["Brand", "Density"]);
    expect(map.get("Brand")!.map((t) => t.name)).toEqual(["Acme", "Globex"]);
  });

  it("never produces an undefined axis key", () => {
    const groups = getAxisGroups(buildAxisMap(parseThemes(UNGROUPED)));
    expect(groups).toEqual([UNGROUPED_AXIS]);
    expect(groups).not.toContain("undefined");
    expect(groups).not.toContain(undefined);
  });
});

describe("getDefaultAxes", () => {
  it("picks the first theme of every axis, in file order", () => {
    expect(getDefaultAxes(buildAxisMap(parseThemes(FOREIGN)))).toEqual({
      Brand: "Acme",
      Density: "Cozy",
    });
  });

  it("defaults the ungrouped axis under its collector name", () => {
    expect(getDefaultAxes(buildAxisMap(parseThemes(UNGROUPED)))).toEqual({
      [UNGROUPED_AXIS]: "Light",
    });
  });
});

describe("describeAxes", () => {
  it("reports values and the default per axis", () => {
    expect(describeAxes(buildAxisMap(parseThemes(FOREIGN)))).toEqual([
      { axis: "Brand", values: ["Acme", "Globex"], default: "Acme" },
      { axis: "Density", values: ["Cozy"], default: "Cozy" },
    ]);
  });
});

describe("validateAxes", () => {
  const map = buildAxisMap(parseThemes(FOREIGN));

  it("accepts axes and values that exist", () => {
    expect(validateAxes(map, { Brand: "Globex", Density: "Cozy" })).toEqual([]);
  });

  it("accepts a partial selection", () => {
    expect(validateAxes(map, { Brand: "Acme" })).toEqual([]);
  });

  it("rejects an axis the loaded themes do not define", () => {
    expect(validateAxes(map, { Semantic: "Light" })).toEqual([
      {
        kind: "unknown-axis",
        axis: "Semantic",
        available: ["Brand", "Density"],
      },
    ]);
  });

  it("rejects a value the axis does not define", () => {
    expect(validateAxes(map, { Brand: "Initech" })).toEqual([
      {
        kind: "unknown-value",
        axis: "Brand",
        value: "Initech",
        available: ["Acme", "Globex"],
      },
    ]);
  });

  it("suggests the correctly-cased axis on a case mismatch", () => {
    expect(validateAxes(map, { brand: "Acme" })).toEqual([
      {
        kind: "unknown-axis",
        axis: "brand",
        available: ["Brand", "Density"],
        suggestion: "Brand",
      },
    ]);
  });

  it("suggests the correctly-cased value on a case mismatch", () => {
    expect(validateAxes(map, { Brand: "globex" })).toEqual([
      {
        kind: "unknown-value",
        axis: "Brand",
        value: "globex",
        available: ["Acme", "Globex"],
        suggestion: "Globex",
      },
    ]);
  });

  it("reports every problem, not just the first", () => {
    expect(validateAxes(map, { Nope: "x", Brand: "Initech" })).toHaveLength(2);
  });
});
