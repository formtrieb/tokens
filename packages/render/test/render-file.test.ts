import { describe, expect, it } from "vitest";
import { parseRenderFile } from "../src/render-file.js";
import type { RenderRule } from "../src/types.js";

const rule: RenderRule = { theme: "Mode/Dark", selector: ".dark", references: true, file: "variables/mode.css" };

describe("parseRenderFile", () => {
  it("reads a bare list of rules without options", () => {
    expect(parseRenderFile([rule])).toEqual({ options: {}, rules: [rule] });
  });

  it("reads rules with output options", () => {
    const options = { prefix: "x-", dialect: "canonical", basePxFontSize: 10, units: "source", color: "rgb" };
    expect(parseRenderFile({ options, rules: [rule] })).toEqual({ options, rules: [rule] });
    expect(parseRenderFile({ rules: [rule] })).toEqual({ options: {}, rules: [rule] });
  });

  it("refuses options that are no output options, naming them", () => {
    expect(() => parseRenderFile({ options: { typography: {} }, rules: [] })).toThrow(/options\.typography is not an output option/);
    expect(() => parseRenderFile({ options: { dialect: "swift" }, rules: [] })).toThrow(/options\.dialect has an invalid value/);
    expect(() => parseRenderFile({ options: { basePxFontSize: 0 }, rules: [] })).toThrow(/basePxFontSize/);
  });

  it("names the broken rule and the file", () => {
    expect(() => parseRenderFile({ rules: [rule, { ...rule, selector: "" }] }, "out/render.json")).toThrow(
      /^out\/render\.json: rules\[1\]\.selector must be a non-empty string/
    );
    expect(() => parseRenderFile([{ ...rule, references: "yes" }])).toThrow(/rules\[0\]\.references/);
    expect(() => parseRenderFile({ options: {} })).toThrow(/expected a list of rules/);
    expect(() => parseRenderFile(null)).toThrow(/expected a list of rules/);
  });
});
