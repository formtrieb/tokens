import { describe, it, expect } from "vitest";
import { transformColorModifiers } from "@tokens-studio/sd-transforms";
import { parse, converter, displayable } from "culori";
import { applyColorModifier } from "../src/parser/color-resolver.js";
import { lightenLch, darkenLch } from "../src/parser/color-modifiers.js";

const toLch = converter("lch");

/**
 * Guards against silent drift from @tokens-studio/sd-transforms, which defines
 * the canonical semantics of Tokens Studio's `modify` extension and generates
 * the CSS that actually ships. If upstream changes a formula, this fails instead
 * of the two implementations quietly disagreeing.
 */

interface Modifier {
  type: string;
  value: string;
  space: string;
}

/** Invoke the real sd-transforms exactly as the generator's `ts/color/modifiers` does. */
function reference(base: string, modifier: Modifier): string {
  const out = transformColorModifiers(
    { $value: base, $extensions: { "studio.tokens": { modify: { ...modifier } } } } as never,
    { format: "srgb" }
  );
  if (out === undefined) throw new Error(`sd-transforms deferred: ${base} ${modifier.type}`);
  return out;
}

/** 8-bit sRGB triple plus alpha. The two sides format differently and are not string-comparable. */
function channels(value: string): [number, number, number, number] {
  const c = parse(value);
  if (!c) throw new Error(`unparseable colour: ${value}`);
  return [
    Math.round((c.r ?? 0) * 255),
    Math.round((c.g ?? 0) * 255),
    Math.round((c.b ?? 0) * 255),
    c.alpha ?? 1,
  ];
}

function maxChannelDelta(a: string, b: string): number {
  const [ar, ag, ab, aa] = channels(a);
  const [br, bg, bb, ba] = channels(b);
  expect(aa).toBeCloseTo(ba, 6);
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
}

/**
 * Whether the *modified* colour (lighten/darken applied, before gamut mapping)
 * fits sRGB. Mirrors the `lightenLch`/`darkenLch` step `applyColorModifier`
 * runs internally, so the tolerance below can be decided per case instead of
 * assumed for the whole block.
 */
function modifiedColorInGamut(base: string, modifier: Modifier): boolean {
  const parsed = parse(base);
  if (!parsed) throw new Error(`unparseable colour: ${base}`);
  const lch = toLch(parsed);
  const amount = parseFloat(modifier.value);
  switch (modifier.type) {
    case "lighten":
      return displayable(lightenLch(lch, amount));
    case "darken":
      return displayable(darkenLch(lch, amount));
    default:
      return displayable(lch);
  }
}

/**
 * Seeded from the combinations that actually occur in the Formtrieb token sets:
 * `lighten 0` (137×), `lighten 0.2` (16×), `darken 0.2` (12×) and the alpha
 * multipliers, on the literal bases those tokens use.
 */
const REAL_CASES: Array<{ base: string; modifier: Modifier }> = [
  { base: "#ffffff", modifier: { type: "lighten", value: "0", space: "lch" } },
  { base: "#000000", modifier: { type: "lighten", value: "0", space: "lch" } },
  { base: "#000000", modifier: { type: "lighten", value: "0.2", space: "lch" } },
  { base: "#ffffff", modifier: { type: "darken", value: "0.2", space: "lch" } },
  { base: "#f305b7", modifier: { type: "darken", value: "0.2", space: "lch" } },
  { base: "#2072b6", modifier: { type: "lighten", value: "0.2", space: "lch" } },
  { base: "#2072b6", modifier: { type: "darken", value: "0.2", space: "lch" } },
  { base: "lch(72% 84 40)", modifier: { type: "lighten", value: "0", space: "lch" } },
  { base: "lch(97% 84 40)", modifier: { type: "lighten", value: "0", space: "lch" } },
  { base: "#ffffff", modifier: { type: "alpha", value: "0.8", space: "lch" } },
  { base: "#000000", modifier: { type: "alpha", value: "0.8", space: "lch" } },
  { base: "#ffffff", modifier: { type: "alpha", value: "0.56", space: "lch" } },
  { base: "#000000", modifier: { type: "alpha", value: "0.43", space: "lch" } },
  { base: "#000000", modifier: { type: "alpha", value: "0.22", space: "lch" } },
  { base: "#ffffff", modifier: { type: "alpha", value: "0.6", space: "lch" } },
  // Out-of-gamut base: without gamut-mapping the base before reading r/g/b, this
  // would resolve to (255, 118, 82) instead of (255, 140, 113). This is the exact
  // case Task 3's "gamut-map before reading channels" alpha fix exists for —
  // do not prune it as redundant with the other alpha rows above.
  { base: "lch(72% 84 40)", modifier: { type: "alpha", value: "0.8", space: "lch" } },
  // lighten/darken applied ON TOP of an alpha'd base. The alpha must survive:
  // these six tokens ship as `rgb(... / 0.56)` and friends in the CSS.
  { base: "rgba(0, 0, 0, 0.56)", modifier: { type: "lighten", value: "0.2", space: "lch" } },
  { base: "rgba(0, 0, 0, 0.43)", modifier: { type: "lighten", value: "0.2", space: "lch" } },
  { base: "rgba(0, 0, 0, 0.22)", modifier: { type: "lighten", value: "0.2", space: "lch" } },
  { base: "rgba(255, 255, 255, 0.56)", modifier: { type: "darken", value: "0.2", space: "lch" } },
  // Out-of-range alpha amounts. sd-transforms' `transparentize` clamps to
  // [0, 1] (`Math.max(0, Math.min(1, Number(amount)))`); ours must match
  // rather than passing the parsed amount through raw.
  { base: "#2072b6", modifier: { type: "alpha", value: "1.5", space: "lch" } },
  { base: "#2072b6", modifier: { type: "alpha", value: "-0.2", space: "lch" } },
];

/** Cases the token sets do not currently exercise. */
const EDGE_CASES: Array<{ base: string; modifier: Modifier }> = [
  { base: "#2072b6", modifier: { type: "lighten", value: "1", space: "lch" } },
  { base: "#2072b6", modifier: { type: "darken", value: "1", space: "lch" } },
  { base: "#808080", modifier: { type: "darken", value: "0.5", space: "lch" } },
  { base: "lch(60% 110 140)", modifier: { type: "darken", value: "0.2", space: "lch" } },
  { base: "lch(30% 70 20)", modifier: { type: "lighten", value: "0.6", space: "lch" } },
  // Translucent base, lighten/darken amount whose channels land well clear of
  // any rounding boundary (~70.63, comfortably mid-gamut) — exercises
  // formatResolved's rgba() branch, the one place `applyColorModifier` rounds
  // r/g/b itself rather than delegating to culori's formatHex. Catches a
  // Math.round → Math.floor regression there that none of the opaque-only
  // cube sweep or the coincidentally-non-discriminating REAL_CASES alpha rows
  // would catch.
  { base: "rgba(0, 0, 0, 0.56)", modifier: { type: "lighten", value: "0.3", space: "lch" } },
];

describe("parity with @tokens-studio/sd-transforms", () => {
  it.each(REAL_CASES)(
    "matches exactly for $base $modifier.type $modifier.value",
    ({ base, modifier }) => {
      const ours = applyColorModifier(base, modifier);
      expect(ours).not.toBeNull();
      expect(maxChannelDelta(ours!, reference(base, modifier))).toBe(0);
    }
  );

  it.each(EDGE_CASES)(
    "matches exactly in-gamut, within 1/255 out-of-gamut, for $base $modifier.type $modifier.value",
    ({ base, modifier }) => {
      // culori and colorjs.io run different gamut-mapping searches. Measured over
      // 9240 synthetic cases: identical for all 5117 in-gamut results, and off by
      // exactly 1 in a single channel for 97 of 4123 out-of-gamut ones. Never more.
      // The design spec requires exact equality for in-gamut results — the split
      // is enforced per case below, not just assumed for the whole block.
      const ours = applyColorModifier(base, modifier);
      expect(ours).not.toBeNull();
      const tolerance = modifiedColorInGamut(base, modifier) ? 0 : 1;
      expect(maxChannelDelta(ours!, reference(base, modifier))).toBeLessThanOrEqual(tolerance);
    }
  );

  /**
   * The exact (l, c, h, type, value) coordinates in the cube sweep below
   * where the in-gamut modified colour sits within ~0.001 of Math.round's .5
   * boundary on one channel: culori's and colorjs.io's independent LCH→sRGB
   * matrices disagree by a few thousandths there (see the per-entry channel
   * values below, e.g. ours 80.4997 vs ref 80.50095), enough to flip which
   * side of the tie the rounded channel lands on. This is not a
   * gamut-mapping disagreement: every one of these colours sits 0.05-0.8
   * away from the nearest [0,1] channel edge (verified directly against the
   * pre-rounding rgb values), comfortably inside the gamut. It is floating-
   * point noise inherent to comparing two independent implementations, not
   * a defect.
   *
   * Listed explicitly — rather than absorbed into a numeric slack budget —
   * so a NEW tie anywhere else in the sweep fails the test loudly instead of
   * being silently spent from an allowance. Re-derive by running the sweep
   * and logging every point where `delta > 0 && inGamut`; there were exactly
   * these six the day this was written (2026-08-23), against this exact grid
   * (l/c/h step 10/13/37, values 0/0.2/0.6). If the sweep's step sizes ever
   * change, this list must be re-measured — it is not guaranteed stable
   * under a different grid, and the `seenTies` assertion below will fail
   * loudly (rather than silently pass) if any listed tie stops reproducing.
   */
  const KNOWN_ROUNDING_TIES = new Set([
    "10,13,296,lighten,0.2", // b channel: ours 80.4997 rounds to 80, ref 80.50095 rounds to 81
    "10,78,296,darken,0.6", // b channel: ours 52.5003 rounds to 53, ref 52.4994 rounds to 52
    "30,78,74,lighten,0.6", // r channel: ours 205.5006 rounds to 206, ref 205.4994 rounds to 205
    // Same LCH point as "10,13,296,lighten,0.2": darkenLch(70,26,0.6) and
    // lightenLch(10,13,0.2) both land on (l=28, c=10.4, h=296).
    "70,26,296,darken,0.6", // b channel: ours 80.4997 rounds to 80, ref 80.50095 rounds to 81
    "70,65,37,darken,0.2", // b channel: ours 82.4993 rounds to 82, ref 82.50015 rounds to 83
    // Same LCH point as "30,78,74,lighten,0.6": darkenLch(90,39,0.2) and
    // lightenLch(30,78,0.6) both land on (l=72, c=31.2, h=74).
    "90,39,74,darken,0.2", // r channel: ours 205.5006 rounds to 206, ref 205.4994 rounds to 205
  ]);

  it("sweeps the LCH cube: exact in-gamut except the six known rounding ties, never exceeding 1/255 out-of-gamut", () => {
    let worst = 0;
    const seenTies = new Set<string>();
    for (let l = 0; l <= 100; l += 10) {
      for (let c = 0; c <= 130; c += 13) {
        for (let h = 0; h < 360; h += 37) {
          const base = `lch(${l}% ${c} ${h})`;
          for (const type of ["lighten", "darken"]) {
            for (const value of ["0", "0.2", "0.6"]) {
              const modifier = { type, value, space: "lch" };
              const ours = applyColorModifier(base, modifier);
              expect(ours).not.toBeNull();
              const inGamut = modifiedColorInGamut(base, modifier);
              const delta = maxChannelDelta(ours!, reference(base, modifier));
              // Never worse than the known out-of-gamut ceiling, in-gamut or not.
              expect(delta).toBeLessThanOrEqual(1);
              const key = `${l},${c},${h},${type},${value}`;
              const isKnownTie = KNOWN_ROUNDING_TIES.has(key);
              if (inGamut) {
                // Exact everywhere in gamut, except the six enumerated ties —
                // any other in-gamut mismatch is a real regression, not noise.
                expect(delta).toBeLessThanOrEqual(isKnownTie ? 1 : 0);
                if (isKnownTie && delta > 0) seenTies.add(key);
              }
              worst = Math.max(worst, delta);
            }
          }
        }
      }
    }
    // Every listed tie must actually reproduce, or the allowlist has drifted
    // from what the current implementation produces (stale entry — investigate
    // rather than assume it's still a harmless tie).
    expect([...seenTies].sort()).toEqual([...KNOWN_ROUNDING_TIES].sort());
    expect(worst).toBeLessThanOrEqual(1);
  });
});
