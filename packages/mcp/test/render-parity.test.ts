/**
 * What the MCP shows is what render writes. For every theme of the synthetic
 * fixture the resolver's E2E test uses, every token the theme writes: the
 * MCP's finalValue (units as written, colours as written) against the value
 * renderVariables writes with references off and the same options.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { themeSelection } from "@formtrieb/tokens-core";
import { kebab, renderVariables } from "@formtrieb/tokens-render";
import { compositionFor } from "../src/composition.js";
import { _clearCacheForTesting, getTokenContext } from "../src/token-context.js";
import { display } from "../src/tools/present.js";
import { setupTools } from "./mock-server.js";

const FIXTURE = fileURLToPath(new URL("../../resolver/tests/fixtures/tokens/", import.meta.url));

beforeEach(() => _clearCacheForTesting());

/** `--x-name: value;` lines of a rendered file → name → value. */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of css.split("\n")) {
    const m = line.match(/^ {2}(--[\w-]+): (.*);$/);
    if (m) out.set(m[1]!, m[2]!);
  }
  return out;
}

describe("MCP finalValue equals render's value, theme by theme", () => {
  it("for every token every theme of the fixture writes", () => {
    const ctx = getTokenContext(FIXTURE);
    let compared = 0;
    let total = 0;
    for (const theme of ctx.system.themes) {
      const id = `${theme.group}/${theme.name}`;
      const css = renderVariables(ctx.system, [{ theme: id, selector: ":root", references: false, file: "t.css" }], { prefix: "x-" }).get("t.css")!;
      const written = declarations(css);
      const { dict, values } = compositionFor(ctx, themeSelection(theme));
      for (const entry of dict.entries) {
        const name = `--${kebab(`x- ${entry.path.join(" ")}`)}`;
        if (!written.has(name)) continue;
        expect(display(values.get(entry.key)!, entry, "source").text, `${id} ${entry.key}`).toBe(written.get(name));
        compared++;
      }
      expect(written.size, id).toBeGreaterThan(0);
      total += written.size;
    }
    // every variable render wrote was compared
    expect(compared).toBe(total);
  });
});

describe("the MCP's unit is the axis selection, render's the single theme", () => {
  it("a component token follows the chosen Semantic axis; render alone writes the later source set", async () => {
    const m = setupTools();
    const at = async (semantic: string) =>
      (await m.callTool("resolve_token", { tokens_path: FIXTURE, path: "button.background", theme: { Semantic: semantic } })).finalValue;
    const light = await at("Light");
    const dark = await at("Dark");
    expect(light).not.toBe(dark);

    const ctx = getTokenContext(FIXTURE);
    const css = renderVariables(ctx.system, [{ theme: "Components-Button/Button", selector: ":root", references: false, file: "b.css" }], {
      prefix: "x-",
    }).get("b.css")!;
    // Components/Button names Semantic/Light and Semantic/Dark as source; Dark comes later and wins.
    expect(declarations(css).get("--x-button-background")).toBe(dark);
  });
});
