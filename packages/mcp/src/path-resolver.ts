import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ResolveContext {
  cwd: string;
}

export interface ResolveResult {
  path: string;
  source: "argument" | "walkup";
}

function walkUpForTokens(startDir: string): string | null {
  let current = resolve(startDir);
  while (true) {
    const tokensDir = join(current, "tokens");
    if (existsSync(join(tokensDir, "$metadata.json"))) {
      return tokensDir;
    }
    // git-subtree layout: a vendored token repo nests one level deeper
    // (<current>/tokens/tokens/$metadata.json).
    const nestedTokensDir = join(tokensDir, "tokens");
    if (existsSync(join(nestedTokensDir, "$metadata.json"))) {
      return nestedTokensDir;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function resolveTokensPath(
  args: { tokens_path?: string },
  ctx: ResolveContext
): ResolveResult {
  if (args.tokens_path) {
    return { path: args.tokens_path, source: "argument" };
  }
  const walkup = walkUpForTokens(ctx.cwd);
  if (walkup) {
    return { path: walkup, source: "walkup" };
  }
  throw new Error(
    "Could not resolve a tokens path. Tried (1) tokens_path argument — none given; (2) walk-up from cwd looking for tokens/$metadata.json — none found. Pass tokens_path, or run from a directory with tokens/$metadata.json above it."
  );
}
