import { describe, expect, it } from "vitest";
import {
  checkAndEvaluateMath,
  transformDimension,
  transformFontWeight,
  transformLetterSpacingForCSS,
  transformLineHeight,
  transformOpacity,
} from "@tokens-studio/sd-transforms";
import {
  alignType,
  canonicalize,
  evaluateMathFor,
  fontWeightFor,
  letterSpacingFor,
  lineHeightFor,
  opacityFor,
  pxFor,
} from "../src/canonicalize/index.js";

/**
 * canonicalize must say exactly what sd-transforms says, value for value:
 * the CSS shipped so far was computed by it, and render reproduces that CSS
 * byte for byte. Each step runs against the real sd-transforms function.
 */

const token = (value: unknown, type: string) => ({ $value: structuredClone(value), $type: type }) as never;

const MATH = [
  // plain numbers stay as written
  "0", "16", "0.10", "1.50", "-3", " ", "",
  // units
  "8px", "1.50px", "0px", "-1px", "48rem", "2em", "100ms", "-3%", "150%", "0%", "50.0%",
  // arithmetic
  "40*0.5", "{x}*0.5", "4 * 2", "16px * 2", "2rem*3", "8rem + 2rem", "(4 + 2) * 3", "10 / 3", "1/3",
  "2^3", "-2^2", "10 % 3", "100px / 3", "0.1 + 0.2", "1 - 0.9",
  // left alone
  "80rem-1px", "1024px-1px", "64rem-1px", "1rem + 2px", "#fff", "#1e1e1e", "#123abc", "#336699",
  "lch(97 0 0)", "lch(97.5 12 250)", "rgba(0,0,0,0.08)", "rgb(0% 0% 0% / 0.6)", "Inter", "JetBrains Mono",
  "none", "desktop", "PI", "E", "small-caps", "line-through",
  // multi values
  "0 4px 8px 0", "0 2 * 2 0", "4px 8px", "1px solid", "(2 + 2) 4", "calc(100% - 2px)",
];

describe("canonicalize parity with sd-transforms", () => {
  it.each(MATH)("resolveMath %j", (v) => {
    expect(evaluateMathFor(v, "dimension")).toEqual(checkAndEvaluateMath(token(v, "dimension")));
  });

  it("resolveMath on composites, per property", () => {
    const typo = { fontSize: "8*2", lineHeight: "150%", fontFamily: "Inter", letterSpacing: "-5%" };
    expect(evaluateMathFor(structuredClone(typo), "typography")).toEqual(
      checkAndEvaluateMath(token(typo, "typography"))
    );
    const shadow = [
      { offsetX: "0", offsetY: "2*2", blur: "8", spread: "0", color: "rgba(0,0,0,0.1)" },
      { offsetX: "1", offsetY: "1", blur: "4px", spread: "0", color: "#000" },
    ];
    expect(evaluateMathFor(structuredClone(shadow), "shadow")).toEqual(checkAndEvaluateMath(token(shadow, "shadow")));
  });

  const DIMENSIONS = ["0", "0px", "8", "8px", "1.5", "0.4", "99999", "48rem", "-3%", "0 4 8 0", "auto", "", "1 solid"];
  it.each(DIMENSIONS)("px %j", (v) => {
    expect(pxFor(v, "dimension")).toEqual(transformDimension(token(v, "dimension")));
  });

  it("px on composites", () => {
    const shadow = [{ offsetX: "0", offsetY: "0.4", blur: "1", spread: "0", color: "#000" }];
    expect(pxFor(structuredClone(shadow), "shadow")).toEqual(transformDimension(token(shadow, "shadow")));
    const typo = { fontSize: "14", lineHeight: "20" };
    expect(pxFor(structuredClone(typo), "typography")).toEqual(transformDimension(token(typo, "typography")));
  });

  it.each(["8%", "0.08", "40%", "1", "0", "abc%"])("opacity %j", (v) => {
    expect(opacityFor(v, "opacity")).toEqual(transformOpacity(v));
  });

  it.each(["150%", "120%", "20px", "1.5", "normal", "4rem"])("lineHeight %j", (v) => {
    expect(lineHeightFor(v, "lineHeight")).toEqual(transformLineHeight(token(v, "lineHeight")));
  });

  const WEIGHTS = ["regular", "Medium", "SemiBold", "bold", "Bold Italic", "italic", "Light Oblique", "700", "Extra Bold", "normal", "unknown"];
  it.each(WEIGHTS)("fontWeight %j", (v) => {
    expect(fontWeightFor(v, "fontWeight")).toEqual(transformFontWeight(token(v, "fontWeight")));
  });

  it.each(["-5%", "0%", "2%", "-0.03em", "1px", "normal"])("letterSpacing %j", (v) => {
    expect(letterSpacingFor(v, "dimension", "letterSpacing")).toEqual(
      transformLetterSpacingForCSS({ $value: v, $type: "dimension" } as never)
    );
  });

  it("typography composite, all steps", () => {
    const typo = { fontFamily: "Inter", fontWeight: "SemiBold", fontSize: "14", lineHeight: "150%", letterSpacing: "-1%" };
    let sd: unknown = checkAndEvaluateMath(token(typo, "typography"));
    sd = transformDimension({ $value: sd, $type: "typography" } as never);
    sd = transformLineHeight({ $value: sd, $type: "typography" } as never);
    sd = transformFontWeight({ $value: sd, $type: "typography" } as never);
    sd = transformLetterSpacingForCSS({ $value: sd, $type: "typography" } as never);
    expect(canonicalize(typo, "typography")).toEqual(sd);
    expect(typo.fontSize).toBe("14");
  });

  it("aligns Tokens Studio types the way the preprocessor does", () => {
    expect(alignType("fontSizes")).toBe("fontSize");
    expect(alignType("letterSpacing")).toBe("dimension");
    expect(alignType("boxShadow")).toBe("shadow");
    expect(alignType("color")).toBe("color");
  });
});
