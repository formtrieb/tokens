import Color from "tinycolor2";
import { describe, expect, it } from "vitest";
import { tinycolor, toHexString, toRgb, toRgbString } from "../src/css/tinycolor.js";

const SAMPLES = [
  "#fff", "#000", "#ffffff", "#336699", "#1e1e1e", "#12345678", "#abcd", "#ABCDEF", " #fff ",
  "rgb(255, 255, 255)", "rgba(0,0,0,0)", "rgba(0, 0, 0, 0.08)", "rgba(0,0,0,0.10)", "rgb(100% 100% 100%)",
  "rgb(96.601% 96.601% 96.601%)", "rgb(0% 0% 0% / 0.6)", "rgb(10.15% 50.714% 71.176%)", "rgb(1.0, 0.5, 0)",
  "hsl(200, 50%, 40%)", "hsla(200, 50%, 40%, 0.5)", "hsv(120, 1, 1)", "white", "Transparent", "rebeccapurple",
  "lch(97 0 0)", "oklch(0.5 0.1 200)", "color(srgb 1 0 0)", "linear-gradient(red, blue)", "none", "", "1.5",
];

describe("tinycolor port", () => {
  it.each(SAMPLES)("%j", (s) => {
    const ours = tinycolor(s);
    const theirs = Color(s);
    expect(ours.ok).toBe(theirs.isValid());
    if (!theirs.isValid()) return;
    expect(toHexString(ours)).toBe(theirs.toHexString());
    expect(toRgb(ours)).toEqual(theirs.toRgb());
    expect(toRgbString(ours)).toBe(theirs.toRgbString());
  });
});
