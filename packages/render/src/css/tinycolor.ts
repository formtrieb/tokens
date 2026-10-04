/**
 * The colour parsing of tinycolor2 1.6, which Style Dictionary's
 * `color/css` and `color/rgb` run on every literal colour. Ported for the
 * bytes it produces, oddities included: `rgb(0% 0% 0% / 0.6)` parses as
 * opaque black, percentages are truncated with `parseInt`.
 * `test/tinycolor.test.ts` checks it against tinycolor2.
 */

const NAMES: Record<string, string> = {
  aliceblue: "f0f8ff", antiquewhite: "faebd7", aqua: "0ff", aquamarine: "7fffd4", azure: "f0ffff",
  beige: "f5f5dc", bisque: "ffe4c4", black: "000", blanchedalmond: "ffebcd", blue: "00f",
  blueviolet: "8a2be2", brown: "a52a2a", burlywood: "deb887", burntsienna: "ea7e5d",
  cadetblue: "5f9ea0", chartreuse: "7fff00", chocolate: "d2691e", coral: "ff7f50",
  cornflowerblue: "6495ed", cornsilk: "fff8dc", crimson: "dc143c", cyan: "0ff", darkblue: "00008b",
  darkcyan: "008b8b", darkgoldenrod: "b8860b", darkgray: "a9a9a9", darkgreen: "006400",
  darkgrey: "a9a9a9", darkkhaki: "bdb76b", darkmagenta: "8b008b", darkolivegreen: "556b2f",
  darkorange: "ff8c00", darkorchid: "9932cc", darkred: "8b0000", darksalmon: "e9967a",
  darkseagreen: "8fbc8f", darkslateblue: "483d8b", darkslategray: "2f4f4f",
  darkslategrey: "2f4f4f", darkturquoise: "00ced1", darkviolet: "9400d3", deeppink: "ff1493",
  deepskyblue: "00bfff", dimgray: "696969", dimgrey: "696969", dodgerblue: "1e90ff",
  firebrick: "b22222", floralwhite: "fffaf0", forestgreen: "228b22", fuchsia: "f0f",
  gainsboro: "dcdcdc", ghostwhite: "f8f8ff", gold: "ffd700", goldenrod: "daa520", gray: "808080",
  green: "008000", greenyellow: "adff2f", grey: "808080", honeydew: "f0fff0", hotpink: "ff69b4",
  indianred: "cd5c5c", indigo: "4b0082", ivory: "fffff0", khaki: "f0e68c", lavender: "e6e6fa",
  lavenderblush: "fff0f5", lawngreen: "7cfc00", lemonchiffon: "fffacd", lightblue: "add8e6",
  lightcoral: "f08080", lightcyan: "e0ffff", lightgoldenrodyellow: "fafad2", lightgray: "d3d3d3",
  lightgreen: "90ee90", lightgrey: "d3d3d3", lightpink: "ffb6c1", lightsalmon: "ffa07a",
  lightseagreen: "20b2aa", lightskyblue: "87cefa", lightslategray: "789", lightslategrey: "789",
  lightsteelblue: "b0c4de", lightyellow: "ffffe0", lime: "0f0", limegreen: "32cd32",
  linen: "faf0e6", magenta: "f0f", maroon: "800000", mediumaquamarine: "66cdaa",
  mediumblue: "0000cd", mediumorchid: "ba55d3", mediumpurple: "9370db", mediumseagreen: "3cb371",
  mediumslateblue: "7b68ee", mediumspringgreen: "00fa9a", mediumturquoise: "48d1cc",
  mediumvioletred: "c71585", midnightblue: "191970", mintcream: "f5fffa", mistyrose: "ffe4e1",
  moccasin: "ffe4b5", navajowhite: "ffdead", navy: "000080", oldlace: "fdf5e6", olive: "808000",
  olivedrab: "6b8e23", orange: "ffa500", orangered: "ff4500", orchid: "da70d6",
  palegoldenrod: "eee8aa", palegreen: "98fb98", paleturquoise: "afeeee", palevioletred: "db7093",
  papayawhip: "ffefd5", peachpuff: "ffdab9", peru: "cd853f", pink: "ffc0cb", plum: "dda0dd",
  powderblue: "b0e0e6", purple: "800080", rebeccapurple: "663399", red: "f00", rosybrown: "bc8f8f",
  royalblue: "4169e1", saddlebrown: "8b4513", salmon: "fa8072", sandybrown: "f4a460",
  seagreen: "2e8b57", seashell: "fff5ee", sienna: "a0522d", silver: "c0c0c0", skyblue: "87ceeb",
  slateblue: "6a5acd", slategray: "708090", slategrey: "708090", snow: "fffafa",
  springgreen: "00ff7f", steelblue: "4682b4", tan: "d2b48c", teal: "008080", thistle: "d8bfd8",
  tomato: "ff6347", turquoise: "40e0d0", violet: "ee82ee", wheat: "f5deb3", white: "fff",
  whitesmoke: "f5f5f5", yellow: "ff0", yellowgreen: "9acd32",
};

const CSS_INTEGER = "[-\\+]?\\d+%?";
const CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";
const CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";
const MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
const MATCH4 =
  "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
const MATCHERS = {
  unit: new RegExp(CSS_UNIT),
  rgb: new RegExp("rgb" + MATCH3),
  rgba: new RegExp("rgba" + MATCH4),
  hsl: new RegExp("hsl" + MATCH3),
  hsla: new RegExp("hsla" + MATCH4),
  hsv: new RegExp("hsv" + MATCH3),
  hsva: new RegExp("hsva" + MATCH4),
  hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
  hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
  hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
  hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
};

type Part = string | number;
interface Parsed {
  r?: Part; g?: Part; b?: Part;
  h?: Part; s?: Part; l?: Part; v?: Part;
  a?: Part;
}

const isOnePointZero = (n: Part) => typeof n === "string" && n.indexOf(".") !== -1 && parseFloat(n) === 1;
const isPercentage = (n: Part) => typeof n === "string" && n.indexOf("%") !== -1;
const isValidUnit = (n: Part | undefined) => n !== undefined && !!MATCHERS.unit.exec(String(n));
const hex = (v: string) => parseInt(v, 16);

function bound01(input: Part, max: number): number {
  let n: Part = isOnePointZero(input) ? "100%" : input;
  const percent = isPercentage(n);
  let x = Math.min(max, Math.max(0, parseFloat(String(n))));
  if (percent) x = parseInt(String(x * max), 10) / 100;
  if (Math.abs(x - max) < 0.000001) return 1;
  return (x % max) / max;
}

function boundAlpha(a: Part): number {
  const x = parseFloat(String(a));
  return isNaN(x) || x < 0 || x > 1 ? 1 : x;
}

const toPercentage = (n: Part): Part => (Number(n) <= 1 ? Number(n) * 100 + "%" : n);

function hslToRgb(h: Part, s: Part, l: Part) {
  const H = bound01(h, 360), S = bound01(s, 100), L = bound01(l, 100);
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (S === 0) r = g = b = L;
  else {
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    r = hue2rgb(p, q, H + 1 / 3);
    g = hue2rgb(p, q, H);
    b = hue2rgb(p, q, H - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function hsvToRgb(h: Part, s: Part, v: Part) {
  const H = bound01(h, 360) * 6, S = bound01(s, 100), V = bound01(v, 100);
  const i = Math.floor(H), f = H - i;
  const p = V * (1 - S), q = V * (1 - f * S), t = V * (1 - (1 - f) * S);
  const mod = i % 6;
  return {
    r: [V, q, p, p, t, V][mod] * 255,
    g: [t, V, V, q, p, p][mod] * 255,
    b: [p, p, t, V, V, q][mod] * 255,
  };
}

function parseString(input: string): Parsed | undefined {
  let color = input.replace(/^\s+/, "").replace(/\s+$/, "").toLowerCase();
  if (NAMES[color]) color = NAMES[color];
  else if (color === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m: RegExpExecArray | null;
  if ((m = MATCHERS.rgb.exec(color))) return { r: m[1], g: m[2], b: m[3] };
  if ((m = MATCHERS.rgba.exec(color))) return { r: m[1], g: m[2], b: m[3], a: m[4] };
  if ((m = MATCHERS.hsl.exec(color))) return { h: m[1], s: m[2], l: m[3] };
  if ((m = MATCHERS.hsla.exec(color))) return { h: m[1], s: m[2], l: m[3], a: m[4] };
  if ((m = MATCHERS.hsv.exec(color))) return { h: m[1], s: m[2], v: m[3] };
  if ((m = MATCHERS.hsva.exec(color))) return { h: m[1], s: m[2], v: m[3], a: m[4] };
  if ((m = MATCHERS.hex8.exec(color))) return { r: hex(m[1]), g: hex(m[2]), b: hex(m[3]), a: hex(m[4]) / 255 };
  if ((m = MATCHERS.hex6.exec(color))) return { r: hex(m[1]), g: hex(m[2]), b: hex(m[3]) };
  if ((m = MATCHERS.hex4.exec(color)))
    return { r: hex(m[1] + m[1]), g: hex(m[2] + m[2]), b: hex(m[3] + m[3]), a: hex(m[4] + m[4]) / 255 };
  if ((m = MATCHERS.hex3.exec(color))) return { r: hex(m[1] + m[1]), g: hex(m[2] + m[2]), b: hex(m[3] + m[3]) };
  return undefined;
}

export interface TinyColor {
  ok: boolean;
  r: number;
  g: number;
  b: number;
  a: number;
}

export function tinycolor(input: unknown): TinyColor {
  let rgb = { r: 0, g: 0, b: 0 };
  let a: Part = 1;
  let ok = false;
  const color = typeof input === "string" ? parseString(input) : undefined;
  if (color) {
    if (isValidUnit(color.r) && isValidUnit(color.g) && isValidUnit(color.b)) {
      rgb = {
        r: bound01(color.r!, 255) * 255,
        g: bound01(color.g!, 255) * 255,
        b: bound01(color.b!, 255) * 255,
      };
      ok = true;
    } else if (isValidUnit(color.h) && isValidUnit(color.s) && isValidUnit(color.v)) {
      rgb = hsvToRgb(color.h!, toPercentage(color.s!), toPercentage(color.v!));
      ok = true;
    } else if (isValidUnit(color.h) && isValidUnit(color.s) && isValidUnit(color.l)) {
      rgb = hslToRgb(color.h!, toPercentage(color.s!), toPercentage(color.l!));
      ok = true;
    }
    if (color.a !== undefined) a = color.a;
  }
  const clamp = (x: number) => {
    const c = Math.min(255, Math.max(x, 0));
    return c < 1 ? Math.round(c) : c;
  };
  return { ok, r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b), a: boundAlpha(a) };
}

const pad2 = (c: string) => (c.length === 1 ? "0" + c : c);

export function toHexString(c: TinyColor): string {
  return "#" + [c.r, c.g, c.b].map((x) => pad2(Math.round(x).toString(16))).join("");
}

export function toRgb(c: TinyColor): { r: number; g: number; b: number; a: number } {
  return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: c.a };
}

export function toRgbString(c: TinyColor): string {
  const [r, g, b] = [c.r, c.g, c.b].map(Math.round);
  return c.a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round(100 * c.a) / 100})`;
}
