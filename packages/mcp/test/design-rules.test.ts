/** check_design_rules: rules as data from argument, path or the file next to the token folder; parity over an axis. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _clearCacheForTesting } from "../src/token-context.js";
import { setupTools } from "./mock-server.js";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const STUDIO = join(FIXTURES, "tokens-studio");
const FOREIGN = join(FIXTURES, "foreign-axes");

let root: string;
const write = (rel: string, data: unknown) => {
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
};

/** A token folder `root/tokens` with one controls token that references the wrong category. */
function controlsSystem() {
  write("tokens/$metadata.json", { tokenSetOrder: ["Semantic"] });
  write("tokens/$themes.json", [{ id: "t", name: "T", group: "T", selectedTokenSets: { Semantic: "enabled" } }]);
  write("tokens/Semantic.json", {
    color: {
      $type: "color",
      interaction: { background: { a: { $value: "#000" } }, icon: { a: { $value: "#111" } } },
      controls: { primary: { icon: { default: { $value: "{color.interaction.background.a}" } } } },
    },
  });
  return join(root, "tokens");
}

beforeEach(() => {
  _clearCacheForTesting();
  root = mkdtempSync(join(tmpdir(), "tokens-rules-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("rule source", () => {
  it("reads tokens.rules.json next to the token folder and names it", async () => {
    const out = await setupTools().callTool("check_design_rules", { tokens_path: STUDIO });
    expect(out.rules).toBe(join(FIXTURES, "tokens.rules.json"));
  });

  it("runs the example rules: a controls token referencing the wrong category", async () => {
    const path = controlsSystem();
    const out = await setupTools().callTool("check_design_rules", { tokens_path: path, rules_path: join(FIXTURES, "tokens.rules.json") });
    expect(out.byRule).toMatchObject({
      "controls-interaction-category-mismatch": {
        count: 1,
        severity: "error",
        example: { path: "color.controls.primary.icon.default", actual: "References color.interaction.background.a" },
      },
    });
  });

  it("takes rules as an argument over any file, and runs only structural checks without rules", async () => {
    const path = controlsSystem();
    const m = setupTools();
    const given = await m.callTool("check_design_rules", {
      tokens_path: path,
      severity: "info",
      rules: { rules: [{ rule: "flat", kind: "depth", max: 3 }] },
    });
    expect(given.rules).toBe("argument");
    expect(Object.keys(given.byRule as object)).toEqual(["flat"]);
    const none = await m.callTool("check_design_rules", { tokens_path: path });
    expect(none.rules).toBe("none");
    expect(none.byRule).toEqual({});
  });

  it("refuses a malformed rule, naming the field", async () => {
    const path = controlsSystem();
    await expect(
      setupTools().callTool("check_design_rules", { tokens_path: path, rules: { rules: [{ rule: "x", kind: "depth" }] } })
    ).rejects.toThrow(/rules\[0\]\.max/);
  });

  it("does not follow a tokens.rules.json that links out of the parent folder", async () => {
    const path = controlsSystem();
    write("elsewhere/rules.json", { rules: [{ rule: "x", kind: "depth", max: 1 }] });
    mkdirSync(join(root, "inner"));
    symlinkSync(join(root, "elsewhere", "rules.json"), join(root, "tokens.rules.json"));
    const out = await setupTools().callTool("check_design_rules", { tokens_path: path });
    expect(out.rules).toBe("none");
  });
});

describe("parity over an axis", () => {
  it("compares the first theme of the first axis with several themes against the others", async () => {
    const out = await setupTools().callTool("check_design_rules", { tokens_path: STUDIO });
    expect(out.parity).toEqual({ axis: "Theme", base: "Light", against: { Dark: { identical: true } } });
  });

  it("takes an axis by name and refuses one the system lacks", async () => {
    const m = setupTools();
    const out = (await m.callTool("check_design_rules", { tokens_path: FOREIGN, axis: "Density" })).parity as { axis: string; base: string };
    expect([out.axis, out.base]).toEqual(["Density", "Cozy"]);
    await expect(m.callTool("check_design_rules", { tokens_path: FOREIGN, axis: "Semantic" })).rejects.toThrow(/Axes in this token system: Brand, Density, Ungrouped/);
  });
});
