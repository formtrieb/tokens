export function evaluateMath(value: string): string | number {
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;

  const hasPercent = value.trim().endsWith("%");
  const cleaned = hasPercent ? value.trim().slice(0, -1) : value.trim();

  if (!/[+\-*/]/.test(cleaned)) return value;

  try {
    if (!/^[\d\s+\-*/.()]+$/.test(cleaned)) return value;

    const result = new Function(`return (${cleaned})`)() as number;

    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return hasPercent ? `${result}%` : result;
    }
  } catch {
    // Expression couldn't be evaluated
  }

  return value;
}

export function containsMath(value: string): boolean {
  if (typeof value !== "string") return false;
  return /\d\s*[+\-*/]\s*\d/.test(value);
}
