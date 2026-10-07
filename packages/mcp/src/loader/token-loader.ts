import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { namedSets } from "@formtrieb/tokens-core";

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
 * `$metadata.json`, `$themes.json`, and the set files these two name
 * (core's `namedSets`) — and nothing else. A folder may hold other JSON (a package.json, build output);
 * it is never read, so it can neither show up as a set nor break loading.
 *
 * Every file read must lie inside the folder after resolving symbolic
 * links — the two index files too. A set name that leaves the folder
 * (`../x`, an absolute path, a link pointing outside) is not read; core
 * then reports it as a missing set.
 */
export function readTokenFiles(tokensPath: string): Map<string, unknown> {
  const root = realpathSync(resolve(tokensPath));
  /** The real path of a file inside the folder, or undefined when there is none or it lies outside. */
  const inside = (name: string): string | undefined => {
    const file = resolve(root, ...name.split("/"));
    if (!existsSync(file)) return undefined;
    const real = realpathSync(file);
    const rel = relative(root, real);
    return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? undefined : real;
  };
  const files = new Map<string, unknown>();
  for (const name of ["$metadata.json", "$themes.json"]) {
    const file = inside(name);
    if (file) files.set(name, readJson(file, name));
  }

  const named = namedSets(files.get("$metadata.json"), files.get("$themes.json"));
  for (const set of named) {
    const file = inside(`${set}.json`);
    if (file) files.set(`${set}.json`, readJson(file, `${set}.json`));
  }
  return files;
}
