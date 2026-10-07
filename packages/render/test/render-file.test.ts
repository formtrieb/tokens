import { describe, expect, it } from "vitest";
import { parseRenderFile } from "../src/render-file.js";
import type { RenderRule } from "../src/types.js";

const rule: RenderRule = { theme: "Mode/Dark", selector: ".dark", references: true, file: "variables/mode.css" };

describe("parseRenderFile", () => {
  it("reads a bare list of rules without options", () => {
    expect(parseRenderFile([rule])).toEqual({ options: {}, rules: [rule] });
  });

  it("reads rules with output options", () => {
    const options = {
      prefix: "x-",
      basePxFontSize: 10,
      units: { types: { dimension: "rem" }, paths: [{ match: "breakpoints.**", unit: "px" }] },
      color: "hex",
      typographyCompanions: true,
    };
    expect(parseRenderFile({ options, rules: [rule] })).toEqual({ options, rules: [rule] });
    expect(parseRenderFile({ options: { units: "tokens-studio" }, rules: [rule] }).options).toEqual({ units: "tokens-studio" });
    expect(parseRenderFile({ rules: [rule] })).toEqual({ options: {}, rules: [rule] });
  });

  it("accepts an older file's dialect 'canonical' without effect and refuses 'style-dictionary'", () => {
    expect(parseRenderFile({ options: { prefix: "x-", dialect: "canonical" }, rules: [rule] }).options).toEqual({ prefix: "x-" });
    expect(() => parseRenderFile({ options: { dialect: "style-dictionary" }, rules: [] })).toThrow(
      /"units": "tokens-studio", "color": "rgb", "typographyCompanions": true/
    );
    expect(() => parseRenderFile({ options: { dialect: "swift" }, rules: [] })).toThrow(/options\.dialect has an invalid value/);
  });

  it("refuses options that are no output options, naming them", () => {
    expect(() => parseRenderFile({ options: { typography: {} }, rules: [] })).toThrow(/options\.typography is not an output option/);
    expect(() => parseRenderFile({ options: { basePxFontSize: 0 }, rules: [] })).toThrow(/basePxFontSize/);
    expect(() => parseRenderFile({ options: { color: "cmyk" }, rules: [] })).toThrow(/options\.color/);
    expect(() => parseRenderFile({ options: { typographyCompanions: "yes" }, rules: [] })).toThrow(/typographyCompanions/);
  });

  it("refuses a malformed unit policy, naming the field", () => {
    const units = (u: unknown) => () => parseRenderFile({ options: { units: u }, rules: [] });
    expect(units("rem")).toThrow(/options\.units: unknown preset "rem"/);
    expect(units({ types: { spacing: "em" } })).toThrow(/options\.units\.types\.spacing must be one of "rem", "px", "source"/);
    expect(units({ paths: [{ match: "", unit: "px" }] })).toThrow(/options\.units\.paths\[0\]\.match/);
    expect(units({ paths: [{ match: "a..b", unit: "px" }] })).toThrow(/options\.units\.paths\[0\]\.match/);
    expect(units({ paths: [{ match: "a", unit: "unitless" }] })).toThrow(/options\.units\.paths\[0\]\.unit/);
    expect(units({ type: {} })).toThrow(/options\.units\.type is not part of a unit policy/);
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
