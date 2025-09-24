import type { VariableAlias } from "../types";
import { rgbToHex } from "./color";

export const isAlias = (v: unknown): v is VariableAlias =>
   !!v && typeof v === "object" && (v as any).type === "VARIABLE_ALIAS";

export function normalizeVarName(name: string) {
   return name.replace(/\//g, " / ");
}

export function valueToString(value: any): string {
   if (value == null) return "—";
   if (typeof value === "object" && "r" in value && "g" in value && "b" in value && "a" in value) {
      return rgbToHex(value as any);
   }
   if (typeof value === "number" || typeof value === "string") return String(value);
   if (typeof value === "boolean") return value ? "true" : "false";
   try { return JSON.stringify(value); } catch { return String(value); }
}

export function resolveValueForMode(variable: Variable, modeId: string, seen = new Set<string>()): any {
   const coll = figma.variables.getVariableCollectionById(variable.variableCollectionId)!;
   let v = variable.valuesByMode[modeId] ?? variable.valuesByMode[coll.defaultModeId];
   if (isAlias(v)) {
      if (seen.has(v.id)) return "⚠️ Alias loop";
      seen.add(v.id);
      const target = figma.variables.getVariableById(v.id);
      if (!target) return "⚠️ Mangler alias-target";
      return resolveValueForMode(target, modeId, seen);
   }
   return v;
}

// Returns the ultimate alias target Variable for given mode if the value is an alias (following chains); otherwise undefined.
export function findAliasTargetForMode(variable: Variable, modeId: string, seen = new Set<string>()): Variable | undefined {
   const coll = figma.variables.getVariableCollectionById(variable.variableCollectionId)!;
   let v = variable.valuesByMode[modeId] ?? variable.valuesByMode[coll.defaultModeId];
   if (isAlias(v)) {
      if (seen.has(v.id)) return undefined; // loop protection
      seen.add(v.id);
      const target = figma.variables.getVariableById(v.id);
      if (!target) return undefined;
      // If target is also alias, keep following to get final variable
      const next = findAliasTargetForMode(target, modeId, seen);
      return next || target;
   }
   return undefined;
}
