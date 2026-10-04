/**
 * `main.css`: an `@import` for every generated variables and utilities file,
 * below whatever a person wrote into the existing file.
 */
const GENERATED_NOTE = "/* Auto-generated — do not edit manually. Run: npx formtrieb-tokens */";
const UTILITY_NOTE = "/* Utility classes — auto-generated */";

function isGenerated(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith("/* Auto-generated") ||
    t.startsWith("/* Utility") ||
    (t.startsWith("@import") && (t.includes("./variables/") || t.includes("./utilities/")))
  );
}

export function mainCss(files: Iterable<string>, existing = ""): string {
  const all = [...files];
  const pick = (dir: string) =>
    all.filter((f) => f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes("/") && f.endsWith(".css")).sort();

  const manual = existing
    .split("\n")
    .filter((line) => !isGenerated(line))
    .join("\n")
    .trimEnd();

  const variables = [GENERATED_NOTE, ...pick("variables").map((f) => `@import './${f}';`)].join("\n");
  const utilities = pick("utilities");
  const utilityBlock = utilities.length > 0 ? "\n" + [UTILITY_NOTE, ...utilities.map((f) => `@import './${f}';`)].join("\n") : "";

  const generated = variables + utilityBlock;
  return manual ? `${manual}\n${generated}\n` : `${generated}\n`;
}
