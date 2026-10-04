/**
 * Tokens Studio math, as `@tokens-studio/sd-transforms` evaluates it
 * (`ts/resolveMath`, `checkAndEvaluateMath`). The CSS that ships today was
 * computed this way, so the rules are kept exactly — including the odd ones:
 *
 *   - a value that is already a number stays as it was written (`"0.10"`)
 *   - `px` is ignored while computing and put back if nothing else was there
 *   - two different units leave the expression untouched (`80rem-1px`)
 *   - a result is cut to 4 fraction digits (`Number(x.toFixed(4))`)
 *   - a space-separated value is split into single expressions first
 *     (`0 {a}*2 0` → three values), unless a piece sits inside `( … )`
 *
 * sd-transforms evaluates with expr-eval and falls back to a CSS calc
 * reducer; both are reproduced here for the arithmetic Tokens Studio allows.
 * `test/canonicalize-parity.test.ts` checks it against sd-transforms.
 */

const MATH_CHARS = ["+", "-", "*", "/"];
const FRACTION_DIGITS = 4;

function checkIfInsideGroup(expr: string, fullExpr: string): boolean {
  const escaped = expr.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
  const reg = new RegExp(`\\(.*?${escaped}.*?\\)`, "g");
  return !!fullExpr.match(reg) || !!expr.match(/\(/g);
}

function splitMultiIntoSingleValues(expr: string): string[] {
  const tokens = expr.split(" ");
  const indexes: number[] = [];
  let skipNextIteration = false;
  tokens.forEach((tok, i) => {
    const left = i > 0 ? tokens[i - 1] : "";
    const right = tokens[i + 1] ?? "";
    const conditions = [
      MATH_CHARS.includes(tok),
      MATH_CHARS.includes(right) && MATH_CHARS.includes(left),
      left === "" && MATH_CHARS.includes(right),
      right === "" && MATH_CHARS.includes(left),
      tokens.length <= 1,
      Boolean(tok.match(/\)$/) && MATH_CHARS.includes(right)),
      checkIfInsideGroup(tok, expr),
    ];
    if (conditions.every((c) => !c)) {
      if (!skipNextIteration) {
        indexes.push(i);
        if (!MATH_CHARS.find((char) => tok.includes(char))) skipNextIteration = true;
      } else {
        skipNextIteration = false;
      }
    }
  });
  if (indexes.length === 0) return [expr];
  indexes.push(tokens.length);
  const out: string[] = [];
  let current = 0;
  for (const i of indexes) {
    const single = tokens.slice(current, i + 1).join(" ");
    if (single) out.push(single);
    current = i + 1;
  }
  return out;
}

// ── arithmetic ────────────────────────────────────────────────────────────

interface Num {
  value: number;
  unit: string;
}

type Tok = { kind: "num"; value: number; unit: string } | { kind: "op"; op: string };

/**
 * Tokenise numbers (optionally with a unit), operators and parentheses.
 * Anything else — names, `#`, commas, functions — and the expression is not
 * arithmetic: undefined.
 */
function tokenize(expr: string, withUnits: boolean): Tok[] | undefined {
  const tokens: Tok[] = [];
  const re = withUnits
    ? /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)([a-zA-Z]+|%)?|([-+*/%^()]))/y
    : /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|(PI|E)\b|([-+*/%^()]))/y;
  let pos = 0;
  const src = expr.trimEnd();
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) return undefined;
    pos = re.lastIndex;
    if (withUnits) {
      if (m[1] !== undefined) tokens.push({ kind: "num", value: Number(m[1]), unit: m[2] ?? "" });
      else tokens.push({ kind: "op", op: m[3] });
    } else if (m[1] !== undefined) {
      tokens.push({ kind: "num", value: Number(m[1]), unit: "" });
    } else if (m[2] !== undefined) {
      tokens.push({ kind: "num", value: m[2] === "PI" ? Math.PI : Math.E, unit: "" });
    } else {
      tokens.push({ kind: "op", op: m[3] });
    }
  }
  return tokens;
}

/**
 * Precedence-climbing evaluation. `plain` follows expr-eval (`%` is modulo,
 * `^` is power, units do not exist); the calc variant follows CSS calc (units
 * must agree for `+`/`-`, at most one side of `*` carries one, `/` divides by
 * a plain number; `%` is a unit, not an operator).
 */
function evaluate(tokens: Tok[], calc: boolean): Num | undefined {
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (op: string) => {
    const t = tokens[i];
    return t?.kind === "op" && t.op === op;
  };

  const binaryOps: Record<string, number> = calc
    ? { "+": 1, "-": 1, "*": 2, "/": 2 }
    : { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

  function primary(): Num | undefined {
    const t = peek();
    if (!t) return undefined;
    if (t.kind === "num") {
      i++;
      return { value: t.value, unit: t.unit };
    }
    if (t.op === "(") {
      i++;
      const v = expression(1);
      if (!v || !isOp(")")) return undefined;
      i++;
      return v;
    }
    if (t.op === "-" || t.op === "+") {
      i++;
      // expr-eval binds unary minus tighter than `^`'s left side, but looser
      // than its right: -2^2 = -4. calc has no `^`.
      const v = calc ? primary() : power();
      if (!v) return undefined;
      return t.op === "-" ? { value: -v.value, unit: v.unit } : v;
    }
    return undefined;
  }

  function power(): Num | undefined {
    const base = primary();
    if (!base || calc || !isOp("^")) return base;
    i++;
    const exp = primary();
    if (!exp) return undefined;
    return { value: Math.pow(base.value, exp.value), unit: "" };
  }

  function apply(op: string, a: Num, b: Num): Num | undefined {
    if (!calc) {
      switch (op) {
        case "+": return { value: a.value + b.value, unit: "" };
        case "-": return { value: a.value - b.value, unit: "" };
        case "*": return { value: a.value * b.value, unit: "" };
        case "/": return { value: a.value / b.value, unit: "" };
        case "%": return { value: a.value % b.value, unit: "" };
        case "^": return { value: Math.pow(a.value, b.value), unit: "" };
      }
      return undefined;
    }
    switch (op) {
      case "+":
      case "-":
        if (a.unit !== b.unit) return undefined;
        return { value: op === "+" ? a.value + b.value : a.value - b.value, unit: a.unit };
      case "*":
        if (a.unit && b.unit) return undefined;
        return { value: a.value * b.value, unit: a.unit || b.unit };
      case "/":
        if (b.unit || b.value === 0) return undefined;
        return { value: a.value / b.value, unit: a.unit };
    }
    return undefined;
  }

  function expression(minPrec: number): Num | undefined {
    let left = power();
    if (!left) return undefined;
    for (;;) {
      const t = peek();
      if (!t || t.kind !== "op" || !(t.op in binaryOps)) break;
      const prec = binaryOps[t.op];
      if (prec < minPrec) break;
      i++;
      const right = expression(t.op === "^" ? prec : prec + 1);
      if (!right) return undefined;
      left = apply(t.op, left, right);
      if (!left) return undefined;
    }
    return left;
  }

  const result = expression(1);
  if (!result || i !== tokens.length) return undefined;
  return result;
}

/** One single value: a plain number stays as written, an expression is reduced. */
export function parseAndReduce(expr: string, fractionDigits = FRACTION_DIGITS): string | number {
  if (!isNaN(Number(expr))) return expr;

  const hasPx = expr.match("px");
  const noPixExpr = expr.replace(/px/g, "");
  const unitRegex = /(\d+\.?\d*)(?<unit>([a-zA-Z]|%)+)/g;
  const foundUnits = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = unitRegex.exec(noPixExpr)) !== null) {
    if (match.groups) foundUnits.add(match.groups.unit);
  }
  if (foundUnits.size > 1) return expr;
  const resultUnit = [...foundUnits][0] ?? (hasPx ? "px" : "");

  let result: number | undefined;
  if (!isNaN(Number(noPixExpr))) result = Number(noPixExpr);

  if (result === undefined) {
    const tokens = tokenize(noPixExpr, false);
    const v = tokens && evaluate(tokens, false);
    if (v && typeof v.value === "number") result = v.value;
  }

  if (result === undefined) {
    let toParse = noPixExpr;
    if (!toParse.match(/[/+%-]/g)) toParse = toParse.replace(new RegExp(resultUnit, "g"), "");
    const tokens = tokenize(toParse, true);
    const v = tokens && evaluate(tokens, true);
    if (v && !isNaN(v.value)) result = v.value;
  }

  if (result === undefined) return expr;
  const fixed = Number(Number.parseFloat(`${result}`).toFixed(fractionDigits));
  return resultUnit ? `${fixed}${resultUnit}` : fixed;
}

/** `ts/resolveMath` for one value: string expressions reduced, everything else untouched. */
export function resolveMath(value: unknown, fractionDigits = FRACTION_DIGITS): unknown {
  if (typeof value !== "string") return value;
  const reduced = splitMultiIntoSingleValues(value).map((e) => parseAndReduce(e, fractionDigits));
  return reduced.length === 1 ? reduced[0] : reduced.join(" ");
}
