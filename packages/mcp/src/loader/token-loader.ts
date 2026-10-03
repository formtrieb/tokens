import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export interface TokenSetData {
  name: string;
  data: Record<string, unknown>;
}

export class TokenLoader {
  private tokensPath: string;
  private sets: Map<string, Record<string, unknown>> = new Map();
  private tokenSetOrder: string[] = [];

  constructor(tokensPath: string) {
    this.tokensPath = tokensPath;
  }

  load(): void {
    this.loadMetadata();
    this.loadTokenSets();
  }

  private loadMetadata(): void {
    const metadataPath = join(this.tokensPath, "$metadata.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    this.tokenSetOrder = metadata.tokenSetOrder;
  }

  private loadTokenSets(): void {
    this.sets.clear();
    for (const setName of this.tokenSetOrder) {
      const filePath = this.setFile(setName);
      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        this.sets.set(setName, data);
      } catch {
        // Set listed in metadata but file missing — skip
      }
    }
  }

  /**
   * Set names come from `$metadata.json` and become file paths. A name like
   * `../x` would read outside the token folder, so it is refused.
   */
  private setFile(setName: string): string {
    const root = resolve(this.tokensPath);
    const filePath = resolve(root, ...setName.split("/")) + ".json";
    const rel = relative(root, filePath);
    if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
      throw new Error(
        `Token set "${setName}" in $metadata.json points outside the token folder.`
      );
    }
    return filePath;
  }

  getTokenSetOrder(): string[] {
    return this.tokenSetOrder;
  }

  getSet(name: string): Record<string, unknown> | undefined {
    return this.sets.get(name);
  }

  getAllSets(): Map<string, Record<string, unknown>> {
    return this.sets;
  }

  getLayerForSet(setName: string): string {
    const parts = setName.split("/");
    return parts.length > 1 ? parts[0] : setName;
  }
}
