import { kebabCase } from "change-case";
import { describe, expect, it } from "vitest";
import { kebab } from "../src/kebab.js";

const SAMPLES = [
  "Display 1",
  "textCase",
  "0_25x",
  "Components-Button",
  "Foundation",
  "  padded  ",
  "XMLHttpRequest",
  "lineHeight2x",
  "*private",
  "Ölfarbe Größe",
  "a--b__c  d",
  "",
  "1.5",
  "space-0-5x",
];

describe("kebab", () => {
  it.each(SAMPLES)("matches change-case for %j", (s) => {
    expect(kebab(s)).toBe(kebabCase(s));
  });

  it("joins a path with '-' before splitting, like the resolver", () => {
    expect(kebab(["Label", "Lg"])).toBe(kebabCase("Label-Lg"));
  });
});
