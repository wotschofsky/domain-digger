// dns-packet's types submodule ships no declarations (@types/dns-packet only
// covers the main entry).
declare module 'dns-packet/types' {
  export function toType(name: string): number;
  export function toString(type: number): string;
}
