import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The parsed file, or a thrown error naming it. */
function readJson(file: string, name: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`Token file ${name} is no valid JSON: ${(e as Error).message}`);
  }
}

/**
 * The files of a token folder as core's `buildTokenSystem` takes them:
 * `$metadata.json`, `$themes.json`, and the set files these two name — and
 * nothing else. A folder may hold other JSON (a package.json, build output);
 * it is never read, so it can neither show up as a set nor break loading.
 *
 * A set name is a path inside the folder. A name that leaves the folder
 * (`../x`, or a symbolic link pointing outside) is not read; core then
 * reports it as a missing set.
 */
export function readTokenFiles(tokensPath: string): Map<string, unknown> {
  const root = realpathSync(resolve(tokensPath));
  const files = new Map<string, unknown>();
  for (const name of ["$metadata.json", "$themes.json"]) {
    const file = resolve(root, name);
    if (existsSync(file)) files.set(name, readJson(file, name));
  }

  const named = new Set<string>();
  const meta = files.get("$metadata.json");
  if (isObject(meta) && Array.isArray(meta.tokenSetOrder)) {
    for (const set of meta.tokenSetOrder) if (typeof set === "string") named.add(set);
  }
  const themes = files.get("$themes.json");
  if (Array.isArray(themes)) {
    for (const theme of themes) {
      if (isObject(theme) && isObject(theme.selectedTokenSets)) for (const set of Object.keys(theme.selectedTokenSets)) named.add(set);
    }
  }

  for (const set of named) {
    const file = resolve(root, ...set.split("/")) + ".json";
    if (!existsSync(file)) continue;
    const real = realpathSync(file);
    const rel = relative(root, real);
    if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) continue;
    files.set(`${set}.json`, readJson(real, `${set}.json`));
  }
  return files;
}
