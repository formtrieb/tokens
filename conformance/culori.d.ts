declare module "culori" {
  export function parse(color: string): any;
  export function converter(mode: string): (color: any) => any;
}
