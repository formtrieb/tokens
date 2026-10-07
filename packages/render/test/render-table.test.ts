import { readFileSync } from "node:fs";
import { parseThemes, type ThemeDefinition } from "@formtrieb/tokens-core";
import { describe, expect, it } from "vitest";
import { deriveRenderTable } from "../src/render-table.js";

const FIXTURE = new URL("../../../fixtures/tokens-studio/$themes.json", import.meta.url);

function theme(group: string, name: string): ThemeDefinition {
  return { id: `${group}-${name}`, group, name, selectedTokenSets: {} };
}

describe("deriveRenderTable", () => {
  it("writes a one-theme group to :root and a many-theme group to data attributes", () => {
    const rules = deriveRenderTable([
      theme("Base", "Base"),
      theme("Color Mode", "Light"),
      theme("Color Mode", "Dark"),
    ]);
    expect(rules).toEqual([
      { theme: "Base/Base", selector: ":root", references: true, file: "variables/base.css" },
      {
        theme: "Color Mode/Light",
        selector: '[data-color-mode="Light"]',
        references: true,
        file: "variables/color-mode.css",
      },
      {
        theme: "Color Mode/Dark",
        selector: '[data-color-mode="Dark"]',
        references: true,
        file: "variables/color-mode.css",
      },
    ]);
  });

  it("takes references from themeGroups, then defaultGroupBehavior, then true", () => {
    const themes = [theme("A", "A"), theme("B", "B"), theme("C", "C")];
    expect(
      deriveRenderTable(themes, {
        themeGroups: { A: { useReferences: false } },
        defaultGroupBehavior: { useReferences: true },
      }).map((r) => r.references)
    ).toEqual([false, true, true]);
    expect(
      deriveRenderTable(themes, { defaultGroupBehavior: { useReferences: false } }).map(
        (r) => r.references
      )
    ).toEqual([false, false, false]);
  });

  it("groups by group, in order of first appearance, even when themes interleave", () => {
    const rules = deriveRenderTable([theme("M", "x"), theme("N", "n"), theme("M", "y")]);
    expect(rules.map((r) => r.theme)).toEqual(["M/x", "M/y", "N/n"]);
  });

  it("derives the resolver's file set for the fixture", () => {
    const themes = parseThemes(JSON.parse(readFileSync(FIXTURE, "utf-8")));
    const rules = deriveRenderTable(themes, {
      themeGroups: { Foundation: { useReferences: false } },
      defaultGroupBehavior: { useReferences: true },
    });
    expect([...new Set(rules.map((r) => r.file))].sort()).toEqual([
      "variables/components-button.css",
      "variables/components-card.css",
      "variables/device.css",
      "variables/foundation.css",
      "variables/semantic.css",
      "variables/shape.css",
      "variables/typography.css",
    ]);
    expect(rules.find((r) => r.theme === "Semantic/Dark")).toEqual({
      theme: "Semantic/Dark",
      selector: '[data-semantic="Dark"]',
      references: true,
      file: "variables/semantic.css",
    });
  });
});
