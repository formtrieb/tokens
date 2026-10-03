/**
 * File-by-file comparison of two output trees, for `pnpm conformance --css`.
 *
 * Text, not meaning: the resolver's output is the oracle, and render must
 * write the same bytes — except where the allowlist names a deliberate
 * deviation (FOR-499: two of them). A hunk is allowed when every line on
 * both sides matches an allowlist pattern for that file.
 */

export interface AllowRule {
  /** Issue that decided the deviation, e.g. `FOR-496`. */
  issue: string;
  reason: string;
  /** Regex on the file key (`variables/device.css`, `bundle.css`, …). */
  file: string;
  /** Regex on a single line, either side. */
  line: string;
}

export interface Hunk {
  /** 1-based line in the resolver's file where the hunk starts. */
  at: number;
  sd: string[];
  render: string[];
  /** Issue of the allowlist rule that covers every line, if any. */
  allowed?: string;
}

export type FileStatus = 'identical' | 'allowed' | 'diff' | 'missing' | 'extra';

export interface FileVerdict {
  file: string;
  status: FileStatus;
  /** Only for `diff` and `allowed`. */
  hunks?: Hunk[];
  /** Why render produced no file (the step's error), for `missing`. */
  error?: string;
}

export function isGreen(status: FileStatus): boolean {
  return status === 'identical' || status === 'allowed';
}

/**
 * Line diff by longest common subsequence. Common head and tail are cut
 * first, so the table only spans the changed middle.
 */
export function diffLines(a: string[], b: string[]): Hunk[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }
  const A = a.slice(head, a.length - tail);
  const B = b.slice(head, b.length - tail);
  const n = A.length;
  const m = B.length;

  // lcs[i][j] = LCS length of A[i..] and B[j..], row-major in one array
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] =
        A[i] === B[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }

  const hunks: Hunk[] = [];
  let current: Hunk | undefined;
  const flush = () => {
    if (current) hunks.push(current);
    current = undefined;
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      flush();
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
      current ??= { at: head + i + 1, sd: [], render: [] };
      current.render.push(B[j++]);
    } else {
      current ??= { at: head + i + 1, sd: [], render: [] };
      current.sd.push(A[i++]);
    }
  }
  flush();
  return hunks;
}

function coveringRule(file: string, hunk: Hunk, rules: AllowRule[]): string | undefined {
  const applicable = rules.filter((r) => new RegExp(r.file).test(file));
  if (applicable.length === 0) return undefined;
  const issues = new Set<string>();
  for (const line of [...hunk.sd, ...hunk.render]) {
    const rule = applicable.find((r) => new RegExp(r.line).test(line));
    if (!rule) return undefined;
    issues.add(rule.issue);
  }
  return [...issues].join(', ');
}

export function compareTrees(
  sd: ReadonlyMap<string, string>,
  render: ReadonlyMap<string, string>,
  allow: AllowRule[],
  /** Why render produced no such file, if it knows. */
  errorFor: (file: string) => string | undefined = () => undefined
): FileVerdict[] {
  const files = [...new Set([...sd.keys(), ...render.keys()])].sort();
  return files.map((file): FileVerdict => {
    const s = sd.get(file);
    const r = render.get(file);
    if (s === undefined) return { file, status: 'extra' };
    if (r === undefined) {
      const error = errorFor(file);
      return { file, status: 'missing', ...(error && { error }) };
    }
    if (s === r) return { file, status: 'identical' };

    const hunks = diffLines(s.split('\n'), r.split('\n')).map((h) => {
      const allowed = coveringRule(file, h, allow);
      return allowed ? { ...h, allowed } : h;
    });
    return { file, status: hunks.every((h) => h.allowed) ? 'allowed' : 'diff', hunks };
  });
}
