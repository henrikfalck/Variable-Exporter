import type { VariableAlias } from "../types";
import { rgbToHex } from "./color";

/**
 * Narrow a value to a VariableAlias when it has the expected shape.
 */
export const isAlias = (v: unknown): v is VariableAlias =>
   !!v && typeof v === "object" && (v as any).type === "VARIABLE_ALIAS";

/**
 * Tidy up variable names for visual display.
 * In Figma, names are often slash-delimited; we insert spacing around the slashes for readability.
 */
export function normalizeVarName(name: string) {
   return name.replace(/\//g, " / ");
}

/**
 * Convert a resolved variable value into a human-readable string.
 */
export function valueToString(value: any): string {
   if (value == null) return "—";
   if (typeof value === "object" && "r" in value && "g" in value && "b" in value && "a" in value) {
      return rgbToHex(value as any);
   }
   if (typeof value === "number" || typeof value === "string") return String(value);
   if (typeof value === "boolean") return value ? "true" : "false";
   try { return JSON.stringify(value); } catch { return String(value); }
}

/**
 * Resolve the value of a variable for a specific mode.
 * Follows alias chains safely (loop-protected) and returns the final concrete value.
 */
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
/**
 * If a variable's value is an alias in the given mode, return the target Variable (following alias chains).
 * Returns undefined when the value is concrete for that mode.
 */
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
