import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every `.json` file below the token folder, as the map core's
 * `buildTokenSystem` takes (path relative to the folder, with `/` → parsed
 * JSON). Which file is a set and in which order sets come is core's
 * decision; this only reads.
 *
 * Only what lies inside the folder is read: the folder is walked, nothing is
 * opened by a name from a file, and symbolic links are not followed. A set
 * that `$metadata.json` names as `../x` therefore is never read; core reports
 * it as missing.
 */
export function readTokenFiles(tokensPath: string): Map<string, unknown> {
  const files = new Map<string, unknown>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        const rel = relative(tokensPath, full).split(sep).join("/");
        try {
          files.set(rel, JSON.parse(readFileSync(full, "utf-8")));
        } catch (e) {
          throw new Error(`Token file ${rel} is no valid JSON: ${(e as Error).message}`);
        }
      }
    }
  };
  walk(tokensPath);
  return files;
}
