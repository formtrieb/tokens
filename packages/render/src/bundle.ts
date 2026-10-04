/**
 * `bundle.css`: `main.css` with every local `@import` replaced by the file
 * it names; `@import url(…)` lines found inside those files move to the top,
 * where CSS requires them. An import that names no known file stays.
 */
const HEADER = "/* Auto-generated — do not edit. Run: npx formtrieb-tokens */";

/** `./variables/a.css`, `variables/./a.css`, `x/../a.css` → one key. */
function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

export function bundleCss(files: ReadonlyMap<string, string>, main = "main.css"): string {
  const source = files.get(main);
  if (source === undefined) throw new Error(`render: bundle needs ${main}`);
  const urlImports: string[] = [];
  const css = source.replace(/^@import\s+['"](.+?)['"];.*$/gm, (match, importPath: string) => {
    const content = files.get(normalize(importPath));
    if (content === undefined) return match;
    const urls: string[] = [];
    const rest: string[] = [];
    for (const line of content.trim().split("\n")) {
      if (line.trim().startsWith("@import url(")) urls.push(line.trim());
      else rest.push(line);
    }
    urlImports.push(...urls);
    return `/* --- ${importPath} --- */\n${rest.join("\n").trim()}`;
  });
  return [HEADER, ...urlImports, css].join("\n") + "\n";
}
