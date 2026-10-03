import { describe, it, expect } from "vitest";
import { lightenLch, darkenLch } from "../src/parser/color-modifiers.js";

const base = { mode: "lch", l: 50, c: 40, h: 260 };

describe("darkenLch", () => {
  it("scales lightness toward 0 proportionally, not by an absolute step", () => {
    const out = darkenLch(base, 0.2);
    expect(out.l).toBeCloseTo(40, 10); // 50 − 50·0.2 = 40; the pre-fix absolute step gave 50 − 20 = 30
  });

  it("scales chroma down with the amount", () => {
    expect(darkenLch(base, 0.2).c).toBeCloseTo(32, 10); // 40 − 0.2·40
  });

  it("preserves hue", () => {
    expect(darkenLch(base, 0.2).h).toBe(260);
  });

  it("stays at black when already at the boundary", () => {
    expect(darkenLch({ mode: "lch", l: 0, c: 0, h: 0 }, 1).l).toBe(0);
  });

  // amount > 1 never occurs in real token sets, but sd-transforms guards
  // against it anyway, so this pins the Math.max(0, …) clamp for parity —
  // without it a refactor could silently let l/c go negative.
  it("clamps lightness and chroma at 0 when amount overshoots past 1", () => {
    const out = darkenLch(base, 1.5);
    expect(out.l).toBe(0); // 50 − 50·1.5 = −25 without the clamp
    expect(out.c).toBe(0); // 40 − 1.5·40 = −20 without the clamp
  });
});

describe("lightenLch", () => {
  it("scales lightness toward 100 by the remaining distance", () => {
    expect(lightenLch(base, 0.2).l).toBeCloseTo(60, 10); // 50 + (100−50)·0.2
  });

  it("scales chroma down, same as darken", () => {
    expect(lightenLch(base, 0.2).c).toBeCloseTo(32, 10);
  });

  it("stays at white when already at the boundary", () => {
    expect(lightenLch({ mode: "lch", l: 100, c: 0, h: 0 }, 1).l).toBe(100);
  });

  // Same rationale as the darken case above: amount > 1 is out of range for
  // real tokens, but the Math.min(100, …) clamp exists for sd-transforms
  // parity and must stay pinned so it can't be quietly dropped later.
  it("clamps lightness at 100 when amount overshoots past 1", () => {
    expect(lightenLch(base, 1.5).l).toBe(100); // 50 + 50·1.5 = 125 without the clamp
  });
});

describe("a zero amount", () => {
  it("is a mathematical no-op in both directions", () => {
    expect(lightenLch(base, 0)).toEqual(base);
    expect(darkenLch(base, 0)).toEqual(base);
  });
});
