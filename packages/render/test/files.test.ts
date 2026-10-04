import { describe, expect, it } from "vitest";
import {
  renderBundle,
  renderImports,
  renderTokenMap,
  renderUtilities,
  typography,
  type RenderOptions,
  type TokenSystem,
} from "../src/index.js";

const OPTIONS: RenderOptions = { prefix: "x-", basePxFontSize: 16, privateTokenPrefixes: ["*"], typography: {} };

describe("renderImports", () => {
  const files = ["variables/b.css", "variables/a.css", "utilities/u.css", "utilities/_m.scss", "variables/nested/no.css", "bundle.css"];

  it("imports variables, then utilities, sorted, .css only", () => {
    expect(renderImports(files).get("main.css")).toBe(
      [
        "/* Auto-generated — do not edit manually. Run: npx formtrieb-tokens */",
        "@import './variables/a.css';",
        "@import './variables/b.css';",
        "/* Utility classes — auto-generated */",
        "@import './utilities/u.css';",
        "",
      ].join("\n")
    );
  });

  it("keeps hand-written lines on top and drops old generated ones", () => {
    const existing = [
      '@import "reset.css";',
      "/* Auto-generated — do not edit manually. Run: npx formtrieb-tokens */",
      "@import './variables/old.css';",
      "",
    ].join("\n");
    expect(renderImports(["variables/a.css"], existing).get("main.css")).toBe(
      [
        '@import "reset.css";',
        "/* Auto-generated — do not edit manually. Run: npx formtrieb-tokens */",
        "@import './variables/a.css';",
        "",
      ].join("\n")
    );
  });
});

describe("renderBundle", () => {
  it("inlines local imports, hoists url() imports, leaves unknown ones", () => {
    const files = new Map([
      ["main.css", '@import "fonts.css";\n@import \'./variables/a.css\';\n@import "missing.css";\n'],
      ["fonts.css", "@import url('https://fonts.example/x.css');\nbody { font-family: X; }\n"],
      ["variables/a.css", ":root {\n  --a: 1;\n}\n"],
    ]);
    expect(renderBundle(files).get("bundle.css")).toBe(
      [
        "/* Auto-generated — do not edit. Run: npx formtrieb-tokens */",
        "@import url('https://fonts.example/x.css');",
        "/* --- fonts.css --- */",
        "body { font-family: X; }",
        "/* --- ./variables/a.css --- */",
        ":root {",
        "  --a: 1;",
        "}",
        '@import "missing.css";',
        "",
        "",
      ].join("\n")
    );
  });
});

const SYSTEM: TokenSystem = {
  order: ["base", "theme"],
  sets: new Map<string, Record<string, unknown>>([
    ["base", { zIndex: { base: { $value: "0", $type: "number" } } }],
    [
      "theme",
      {
        zIndex: { modal: { $value: "200", $type: "number" } },
        "*private": { x: { $value: "1", $type: "number" } },
        Title: {
          $type: "typography",
          $value: { fontFamily: "Inter", letterSpacing: "{ls}", textCase: "", paragraphSpacing: "{p}" },
        },
      },
    ],
  ]),
  themes: [
    { id: "1", group: "Base", name: "Base", selectedTokenSets: { base: "source", theme: "enabled" } },
  ],
};

describe("renderTokenMap", () => {
  it("maps Figma paths of enabled sets to variables, with typography companions", () => {
    const map = JSON.parse(renderTokenMap(SYSTEM, OPTIONS).get("token-map.json")!);
    expect(map.figmaToCSS).toEqual({
      "zIndex/modal": "--x-z-index-modal",
      Title: "--x-title",
      "Title/letterSpacing": "--x-title-letter-spacing",
      "Title/marginBlockEnd": "--x-title-margin-block-end",
    });
    expect(map.prefix).toBe("--x-");
    expect(map.count).toBe(4);
    expect(map.categories).toEqual({ zIndex: 1, Title: 3 });
  });
});

describe("renderUtilities", () => {
  it("hands builders every token of the system, first set in $metadata order wins", async () => {
    const seen: string[] = [];
    const files = await renderUtilities(
      SYSTEM,
      [
        ({ tokens }) => {
          seen.push(...tokens.map((t) => t.path.join(".")));
          return { filename: "probe.css", content: "" };
        },
        typography(),
      ],
      OPTIONS
    );
    expect(seen).toEqual(["zIndex.base", "zIndex.modal", "*private.x", "Title"]);
    expect([...files.keys()]).toEqual(["utilities/probe.css", "utilities/typography.css"]);
    expect(files.get("utilities/typography.css")).toContain(".x-title {");
  });

  it("refuses two builders writing the same file", async () => {
    const same = () => ({ filename: "a.css", content: "" });
    await expect(renderUtilities(SYSTEM, [same, same], OPTIONS)).rejects.toThrow(/Duplicate utility filename: a.css/);
  });
});
