import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

/** The synthetic Tokens-Studio export, as the file map a loader hands to core. */
export const FIXTURE_DIR = fileURLToPath(new URL("../../../fixtures/tokens-studio/", import.meta.url));

export function readFixture(dir = FIXTURE_DIR): Map<string, unknown> {
  const files = new Map<string, unknown>();
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) {
        files.set(relative(dir, full).split("\\").join("/"), JSON.parse(readFileSync(full, "utf-8")));
      }
    }
  };
  walk(dir);
  return files;
}
