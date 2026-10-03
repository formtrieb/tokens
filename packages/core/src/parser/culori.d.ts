declare module "culori" {
  export function parse(color: string): any;
  export function formatHex(color: any): string;
  export function formatHex8(color: any): string;
  export function formatRgb(color: any): string;
  export function lch(color: any): any;
  export function lch(l: number, c: number, h: number): any;
  export function displayable(color: any, mode?: string): boolean;
  export function converter(mode: string): (color: any) => any;
  export function differenceCiede2000(): (a: any, b: any) => number;
  export function toGamut(
    targetMode?: string,
    mode?: string,
    delta?: unknown,
    jnd?: number
  ): (color: any) => any;
}
