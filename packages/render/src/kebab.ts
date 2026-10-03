/**
 * kebab-case exactly as `change-case` 5 writes it, which is what Style
 * Dictionary's `name/kebab` uses. Variable names, file names and data
 * attributes must stay byte-identical to today's output, so this is a port,
 * not an approximation; `test/kebab.test.ts` checks it against change-case.
 *
 *   "Display 1"          → "display-1"
 *   "textCase"           → "text-case"
 *   "0_25x"              → "0-25x"
 *   "Components-Button"  → "components-button"
 */
const SPLIT_LOWER_UPPER = /([\p{Ll}\d])(\p{Lu})/gu;
const SPLIT_UPPER_UPPER = /(\p{Lu})([\p{Lu}][\p{Ll}])/gu;
const STRIP = /[^\p{L}\d]+/giu;

function split(value: string): string[] {
  let result = value
    .trim()
    .replace(SPLIT_LOWER_UPPER, "$1\0$2")
    .replace(SPLIT_UPPER_UPPER, "$1\0$2")
    .replace(STRIP, "\0");
  let start = 0;
  let end = result.length;
  while (result.charAt(start) === "\0") start++;
  if (start === end) return [];
  while (result.charAt(end - 1) === "\0") end--;
  result = result.slice(start, end);
  return result.split("\0");
}

export function kebab(input: string | readonly string[]): string {
  const str = typeof input === "string" ? input : input.join("-");
  return split(str)
    .map((word) => word.toLowerCase())
    .join("-");
}
