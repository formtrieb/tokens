/**
 * Tokens Studio arithmetic on text: numbers with units, `+ - * /`,
 * parentheses, space-separated lists. Nothing is rounded.
 *
 * Units: `+`/`-` need equal units, a bare number takes the other side's unit
 * (`16px + 4` is `20px`); `*` allows a unit on one side; `/` divides by a
 * bare number, or by the same unit to give a bare number. Anything else is
 * kept as an expression, for an output format to write (`calc()` in CSS).
 */
import type { Expr, TokenValue } from "./types.js";

type Tok =
  | { t: "num"; value: number; unit: string; spaceBefore: boolean }
  | { t: "op"; op: string; spaceBefore: boolean; spaceAfter: boolean };

const NUMBER = /(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)([a-zA-Z]+|%)?/y;
const OPERATOR = /[-+*/()]/y;

function tokenize(text: string): Tok[] | undefined {
  const out: Tok[] = [];
  let pos = 0;
  let space = false;
  while (pos < text.length) {
    if (/\s/.test(text[pos])) {
      pos++;
      space = true;
      continue;
    }
    NUMBER.lastIndex = pos;
    const num = NUMBER.exec(text);
    if (num) {
      out.push({ t: "num", value: Number(num[1]), unit: num[2] ?? "", spaceBefore: space });
      pos = NUMBER.lastIndex;
    } else {
      OPERATOR.lastIndex = pos;
      const op = OPERATOR.exec(text);
      if (!op) return undefined;
      pos = OPERATOR.lastIndex;
      out.push({ t: "op", op: op[0], spaceBefore: space, spaceAfter: pos < text.length && /\s/.test(text[pos]) });
    }
    space = false;
  }
  return out;
}

type Leaf = Extract<TokenValue, { kind: "length" } | { kind: "number" }>;

const leaf = (value: number, unit: string): Leaf => (unit ? { kind: "length", value, unit } : { kind: "number", value });
const unitOf = (l: Leaf) => (l.kind === "length" ? l.unit : "");
const isLeaf = (e: Expr): e is Leaf => !("op" in e) && (e.kind === "length" || e.kind === "number");

function apply(op: "+" | "-" | "*" | "/", a: Expr, b: Expr): Expr {
  if (isLeaf(a) && isLeaf(b)) {
    const ua = unitOf(a);
    const ub = unitOf(b);
    switch (op) {
      case "+":
      case "-":
        if (ua === ub || !ua || !ub) return leaf(op === "+" ? a.value + b.value : a.value - b.value, ua || ub);
        break;
      case "*":
        if (!ua || !ub) return leaf(a.value * b.value, ua || ub);
        break;
      case "/":
        if (b.value !== 0 && !ub) return leaf(a.value / b.value, ua);
        if (b.value !== 0 && ua === ub) return leaf(a.value / b.value, "");
        break;
    }
  }
  return { op, left: a, right: b };
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

/** One parse over the tokens; a value followed by another value starts a new list item. */
function parse(tokens: Tok[]): Expr[] | undefined {
  let i = 0;

  function primary(): Expr | undefined {
    const tok = tokens[i];
    if (!tok) return undefined;
    if (tok.t === "num") {
      i++;
      return leaf(tok.value, tok.unit);
    }
    if (tok.op === "(") {
      i++;
      const inner = expression(1);
      const close = tokens[i];
      if (!inner || close?.t !== "op" || close.op !== ")") return undefined;
      i++;
      return inner;
    }
    if (tok.op === "-" || tok.op === "+") {
      i++;
      const operand = primary();
      if (!operand) return undefined;
      return tok.op === "-" ? apply("*", leaf(-1, ""), operand) : operand;
    }
    return undefined;
  }

  function expression(min: number): Expr | undefined {
    let left = primary();
    if (!left) return undefined;
    for (;;) {
      const tok = tokens[i];
      if (!tok || tok.t !== "op" || !(tok.op in PRECEDENCE)) break;
      // `0 -4px`: a sign glued to its number after a space starts a new item.
      if (tok.op === "-" && tok.spaceBefore && !tok.spaceAfter && tokens[i + 1]?.t === "num") break;
      const prec = PRECEDENCE[tok.op];
      if (prec < min) break;
      i++;
      const right = expression(prec + 1);
      if (!right) return undefined;
      left = apply(tok.op as "+" | "-" | "*" | "/", left, right);
    }
    return left;
  }

  const items: Expr[] = [];
  while (i < tokens.length) {
    const item = expression(1);
    if (!item) return undefined;
    items.push(item);
  }
  return items;
}

const asValue = (e: Expr): TokenValue => ("op" in e ? { kind: "expression", expr: e } : e);

/**
 * The value of an arithmetic text: a number, a length, an expression, or a
 * list of those. Undefined when the text is no arithmetic (a word, a colour,
 * a function call).
 */
export function evaluate(text: string): TokenValue | undefined {
  const tokens = tokenize(text.trim());
  if (!tokens || tokens.length === 0) return undefined;
  const items = parse(tokens);
  if (!items) return undefined;
  return items.length === 1 ? asValue(items[0]) : { kind: "list", items: items.map(asValue) };
}
