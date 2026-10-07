import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTokenSystem } from "@formtrieb/tokens-core";
import { readTokenFiles } from "../src/loader/token-loader.js";
import { _clearCacheForTesting } from "../src/token-context.js";
import { setupTools } from "./mock-server.js";

/**
 * The MCP reads token files the user picks via tokens_path. These tests cover
 * what a foreign token folder could do if one were slipped in: read files
 * outside the folder, or write onto Object.prototype.
 */

let root: string;

function write(rel: string, data: unknown) {
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

beforeEach(() => {
  _clearCacheForTesting();
  root = mkdtempSync(join(tmpdir(), "tokens-hardening-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("reading a token folder — set names from $metadata.json", () => {
  it("never reads a set whose name climbs out of the token folder", () => {
    write("outside.json", { secret: { $type: "color", $value: "#000" } });
    write("tokens/$metadata.json", { tokenSetOrder: ["Base", "../outside"] });
    write("tokens/Base.json", { a: { $type: "color", $value: "#fff" } });

    const files = readTokenFiles(join(root, "tokens"));
    expect([...files.keys()].sort()).toEqual(["$metadata.json", "Base.json"]);
    const { system, problems } = buildTokenSystem(files);
    expect(system.sets.has("../outside")).toBe(false);
    expect(problems).toEqual([{ kind: "missing-set", set: "../outside" }]);
  });

  it("does not follow a symbolic link out of the folder", () => {
    write("outside/secret.json", { secret: { $type: "color", $value: "#000" } });
    write("tokens/$metadata.json", { tokenSetOrder: [] });
    symlinkSync(join(root, "outside"), join(root, "tokens", "linked"));
    expect([...readTokenFiles(join(root, "tokens")).keys()]).toEqual(["$metadata.json"]);
  });

  it("still reads nested set names", () => {
    write("tokens/$metadata.json", { tokenSetOrder: ["Theme/Light"] });
    write("tokens/Theme/Light.json", { a: { $type: "color", $value: "#fff" } });

    const { system } = buildTokenSystem(readTokenFiles(join(root, "tokens")));
    expect(system.sets.get("Theme/Light")).toBeDefined();
  });
});

describe("browse_tokens — tree keys come from token paths", () => {
  it("does not write a __proto__ segment onto Object.prototype", async () => {
    // JSON.parse keeps "__proto__" as an own key, so the flattened path is
    // __proto__.polluted.
    writeFileSync(
      join(root, "$metadata.json"),
      JSON.stringify({ tokenSetOrder: ["Base"] })
    );
    writeFileSync(join(root, "$themes.json"), "[]");
    writeFileSync(
      join(root, "Base.json"),
      '{"__proto__":{"polluted":{"$type":"color","$value":"#f00"}}}'
    );

    const m = setupTools();
    const out = await m.callTool("browse_tokens", {
      tokens_path: root,
      set: "Base",
      depth: 3,
    });

    try {
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      const tree = out.tokens as Record<string, unknown>;
      expect(Object.keys(tree)).toEqual(["__proto__"]);
    } finally {
      delete (Object.prototype as Record<string, unknown>).polluted;
    }
  });
});
