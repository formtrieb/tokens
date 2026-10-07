/**
 * Whether path segments match a pattern's segments: `*` matches one segment,
 * `**` zero or more, any other segment itself. Splitting is the caller's —
 * a token path at `.`, a set name at `/` — so one rule serves both.
 */
export function matchPath(pattern: readonly string[], path: readonly string[]): boolean {
  const at = (p: number, s: number): boolean => {
    if (p === pattern.length) return s === path.length;
    if (pattern[p] === "**") return at(p + 1, s) || (s < path.length && at(p, s + 1));
    if (s === path.length) return false;
    return (pattern[p] === "*" || pattern[p] === path[s]) && at(p + 1, s + 1);
  };
  return at(0, 0);
}
