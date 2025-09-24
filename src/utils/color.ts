import type { RGBA } from "../types";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function rgbToHex(c: RGBA): string {
   const r = Math.round(clamp01(c.r) * 255);
   const g = Math.round(clamp01(c.g) * 255);
   const b = Math.round(clamp01(c.b) * 255);
   const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
   const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
   return c.a < 1 ? hex + toHex(Math.round(c.a * 255)) : hex;
}

export function tryExtractColor(v: unknown): RGBA | undefined {
   if (v && typeof v === "object") {
      const o = v as any;
      if ("r" in o && "g" in o && "b" in o && "a" in o) return o as RGBA;
   }
}
