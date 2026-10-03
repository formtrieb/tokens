import { parse, formatHex8, differenceCiede2000 } from "culori";

const ciede2000 = differenceCiede2000();

export interface ColorCandidate {
  path: string;
  value: string;
}

export interface NearestColorMatch {
  path: string;
  value: string;
  deltaE: number;
}

export interface ColorMatchResult {
  /** The query as given. */
  query: string;
  /** Normalized #rrggbbaa of the query, or null if it isn't a parseable colour. */
  queryHex: string | null;
  /** Paths whose colour is byte-identical to the query (after normalization). */
  exact: string[];
  /** Closest non-exact candidate by CIEDE2000, or null. Only populated when opts.nearest is set. */
  nearest: NearestColorMatch | null;
}

/**
 * Reverse-lookup: given a colour value, find the token paths that produce it.
 *
 * Figma often hands back a raw hex (`text-[#2072b6]`) with no bound variable;
 * this maps that value back to the token(s) that resolve to it. Exact matching
 * is format/casing-insensitive (both sides normalized to #rrggbbaa). With
 * `nearest`, the closest non-exact candidate is returned with its perceptual
 * CIEDE2000 distance — useful when a raw hex drifted slightly from any token.
 *
 * Non-colour candidates (dimensions, numbers, unresolved refs) are skipped.
 */
export function findColorMatches(
  query: string,
  candidates: ColorCandidate[],
  opts: { nearest?: boolean } = {}
): ColorMatchResult {
  const parsedQuery = parse(query);
  if (!parsedQuery) {
    return { query, queryHex: null, exact: [], nearest: null };
  }
  const queryHex = formatHex8(parsedQuery);

  const exact: string[] = [];
  let nearest: NearestColorMatch | null = null;

  for (const { path, value } of candidates) {
    if (typeof value !== "string") continue;
    const parsed = parse(value);
    if (!parsed) continue;

    if (formatHex8(parsed) === queryHex) {
      exact.push(path);
      continue;
    }

    if (opts.nearest) {
      const deltaE = ciede2000(parsedQuery, parsed);
      if (!nearest || deltaE < nearest.deltaE) {
        nearest = { path, value, deltaE };
      }
    }
  }

  return { query, queryHex, exact, nearest };
}
