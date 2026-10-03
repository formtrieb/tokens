/**
 * Value comparison between the two machines.
 *
 * tokens-core hands back the resolved raw value (`#d62c18`, `16px`, `Bold`);
 * Style Dictionary hands back the CSS-platform-transformed value
 * (`rgb(84% 17% 9%)`, `1rem`, `700`). The two notations are expected to
 * differ; the *meaning* must not. Each type therefore gets a canonical form
 * before comparing, and a verdict says how far apart the meanings are.
 */
import { parse, converter } from 'culori';

export type Category =
  | 'match'
  | 'rounding'
  | 'divergent'
  | 'unparseable'
  | 'missing'
  | 'composite';

export const CATEGORIES: Category[] = [
  'match',
  'rounding',
  'divergent',
  'unparseable',
  'missing',
  'composite',
];

export interface Verdict {
  category: Category;
  detail?: string;
}

const toRgb = converter('rgb');

/** Types whose value is an object; compared only as a count for now. */
const COMPOSITE_TYPES = new Set([
  'typography',
  'boxShadow',
  'shadow',
  'border',
  'composition',
  'gradient',
  'strokeStyle',
  'transition',
]);

const FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

export function compareValues(
  type: string | undefined,
  core: unknown,
  sd: unknown
): Verdict {
  if (core === undefined || sd === undefined) {
    return {
      category: 'missing',
      detail: core === undefined ? 'absent in core' : 'absent in style-dictionary',
    };
  }
  if ((type && COMPOSITE_TYPES.has(type)) || isPlainObject(core) || isPlainObject(sd)) {
    return { category: 'composite' };
  }

  switch (type) {
    case 'color':
      return compareColor(String(core), String(sd));
    case 'fontWeights':
    case 'fontWeight':
      return compareFontWeight(String(core), String(sd));
    case 'fontFamilies':
    case 'fontFamily':
      return compareText(unquote(String(core)), unquote(String(sd)));
    case 'cubicBezier':
      return compareCubicBezier(core, sd);
    default: {
      if (!type && parse(String(core)) && parse(String(sd))) {
        return compareColor(String(core), String(sd));
      }
      const a = parseQuantity(String(core), type);
      const b = parseQuantity(String(sd), type);
      if (a && b) return compareQuantity(a, b);
      if (a || b) {
        return {
          category: 'unparseable',
          detail: `core "${display(core)}" vs sd "${display(sd)}"`,
        };
      }
      return compareText(String(core), String(sd));
    }
  }
}

export function display(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function unquote(s: string): string {
  return s
    .split(',')
    .map((part) => part.trim().replace(/^['"](.*)['"]$/, '$1'))
    .join(', ');
}

// ── colour ────────────────────────────────────────────────────────────────

function compareColor(a: string, b: string): Verdict {
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) {
    return {
      category: 'unparseable',
      detail: `${ca ? '' : `core "${a}" is not a colour`}${!ca && !cb ? '; ' : ''}${cb ? '' : `sd "${b}" is not a colour`}`,
    };
  }
  const A = channels(toRgb(ca));
  const B = channels(toRgb(cb));
  const d = Math.max(...A.map((v, i) => Math.abs(v - B[i])));
  if (d === 0) return { category: 'match' };
  if (d <= 1) return { category: 'rounding', detail: `Δ ${d}/255` };
  return {
    category: 'divergent',
    detail: `Δ ${d}/255 — rgba(${A.join(',')}) vs rgba(${B.join(',')})`,
  };
}

function channels(c: { r: number; g: number; b: number; alpha?: number }): number[] {
  return [c.r, c.g, c.b, c.alpha ?? 1].map((v) => Math.round(v * 255));
}

// ── quantities ────────────────────────────────────────────────────────────

interface Quantity {
  n: number;
  unit: string;
}

const QUANTITY = /^(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-z%]*)$/i;

/** Tokens Studio treats a bare number as px for these types. */
const LENGTH_TYPES = new Set([
  'dimension',
  'spacing',
  'sizing',
  'borderradius',
  'borderwidth',
  'fontsizes',
  'fontsize',
  'paragraphspacing',
  'paragraphindent',
]);

/**
 * Canonical form: rem→px (16), s→ms, letter-spacing %→em, line-height
 * %→unitless, bare length numbers→px, and zero carries no unit at all.
 */
export function parseQuantity(s: string, type?: string): Quantity | null {
  const m = QUANTITY.exec(s.trim());
  if (!m) return null;
  let n = parseFloat(m[1]);
  let unit = m[2].toLowerCase();
  const t = (type ?? '').toLowerCase();

  if (unit === '%' && t.startsWith('letterspacing')) {
    n /= 100;
    unit = 'em';
  } else if (unit === '%' && t.startsWith('lineheight')) {
    n /= 100;
    unit = '';
  }
  if (unit === 'rem') {
    n *= 16;
    unit = 'px';
  }
  if (unit === 's') {
    n *= 1000;
    unit = 'ms';
  }
  if (unit === '' && LENGTH_TYPES.has(t)) unit = 'px';
  if (n === 0) unit = '';
  return { n, unit };
}

function compareQuantity(a: Quantity, b: Quantity): Verdict {
  if (a.unit !== b.unit) {
    return {
      category: 'divergent',
      detail: `unit ${a.unit || '(none)'} vs ${b.unit || '(none)'}`,
    };
  }
  const tolerance = 1e-6 * Math.max(1, Math.abs(a.n));
  if (Math.abs(a.n - b.n) <= tolerance) return { category: 'match' };
  return { category: 'divergent', detail: `Δ ${a.n - b.n}${a.unit}` };
}

// ── text-like ─────────────────────────────────────────────────────────────

function compareFontWeight(a: string, b: string): Verdict {
  const wa = fontWeightNumber(a);
  const wb = fontWeightNumber(b);
  if (wa === null || wb === null) {
    return { category: 'unparseable', detail: `core "${a}" vs sd "${b}"` };
  }
  if (wa === wb) return { category: 'match' };
  return { category: 'divergent', detail: `${wa} vs ${wb}` };
}

function fontWeightNumber(s: string): number | null {
  const key = s.toLowerCase().replace(/italic|oblique/g, '').replace(/[\s_-]/g, '');
  if (key in FONT_WEIGHTS) return FONT_WEIGHTS[key];
  const n = parseInt(key, 10);
  return Number.isFinite(n) ? n : null;
}

function compareText(a: string, b: string): Verdict {
  if (a.trim() === b.trim()) return { category: 'match' };
  return { category: 'divergent', detail: `"${a}" vs "${b}"` };
}

/** Four numbers on both sides, however they are spelled; anything else is a defect in the source. */
function compareCubicBezier(a: unknown, b: unknown): Verdict {
  const na = bezierNumbers(a);
  const nb = bezierNumbers(b);
  if (!na || !nb) {
    return {
      category: 'unparseable',
      detail: `not four numbers — core ${display(a)}, sd ${display(b)}`,
    };
  }
  const d = Math.max(...na.map((v, i) => Math.abs(v - nb[i])));
  if (d <= 1e-6) return { category: 'match' };
  return { category: 'divergent', detail: `${display(na)} vs ${display(nb)}` };
}

function bezierNumbers(v: unknown): number[] | null {
  const parts: unknown[] = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? (v.match(/^cubic-bezier\((.*)\)$/)?.[1] ?? v).split(',')
      : [];
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (typeof p === 'number' ? p : parseFloat(String(p).trim())));
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

function compareJson(a: unknown, b: unknown): Verdict {
  if (JSON.stringify(a) === JSON.stringify(b)) return { category: 'match' };
  return { category: 'divergent', detail: `${display(a)} vs ${display(b)}` };
}
