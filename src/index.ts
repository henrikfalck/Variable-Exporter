import { autoH, autoV } from "./utils/layout";
import { loadFonts, makeText } from "./utils/text";
import { tryExtractColor } from "./utils/color";
import { normalizeVarName, resolveValueForMode, valueToString, findAliasTargetForMode } from "./utils/variables";
import type { CollectionInfo, ExportRequest } from "./types";

function makeDivider(): RectangleNode {
   const d = figma.createRectangle();
   d.resize(1, 1);
   d.layoutAlign = "STRETCH";
   d.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.2 }];
   d.strokes = [];
   d.name = "Divider";
   return d;
}

function getCollectionsSnapshot(): CollectionInfo[] {
   const variables = figma.variables.getLocalVariables();
   const collections = figma.variables.getLocalVariableCollections();
   const countByCollection: Record<string, number> = {};
   for (const v of variables) {
      const prev = countByCollection[v.variableCollectionId];
      countByCollection[v.variableCollectionId] = (typeof prev === "number" ? prev : 0) + 1;
   }
   return collections.map(c => ({
      id: c.id,
      name: c.name || "Untitled Collection",
      defaultModeId: c.defaultModeId,
      modes: c.modes.map(m => ({ id: m.modeId, name: m.name })),
      variableCount: (typeof countByCollection[c.id] === "number" ? countByCollection[c.id] : 0)
   }));
}

/**
 * Build the documentation frames for the current document's local variable collections.
 * - One collection card per collection
 * - Header row with fixed-width columns
 * - Grouped rows by first name segment (only when present)
 * - Per-mode cells render value, color swatch, boolean chip, or alias chip
 */
async function renderExport(req: ExportRequest) {
   await loadFonts();

   const allVars = figma.variables.getLocalVariables();
   const collections = figma.variables.getLocalVariableCollections();

   if (!collections.length || !allVars.length) {
      figma.notify("Fant ingen lokale variabler i dette dokumentet.");
      return;
   }

   // Merk: Vi rydder ikke lenger vekk eksisterende root/collection ved re‑eksport; nye collections appender til root

   // Reuse existing root if present; else create
   let root = figma.currentPage.findOne(n => n.type === "FRAME" && n.name === "Variables Export (Root)") as FrameNode | null;
   if (!root) {
      root = figma.createFrame();
      root.name = "Variables Export (Root)";
      root.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.02 }];
      root.strokes = [];
      root.layoutMode = "VERTICAL";
      root.primaryAxisSizingMode = "AUTO";
      root.counterAxisSizingMode = "AUTO";
      root.itemSpacing = 24;
      root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = 16;
      figma.currentPage.appendChild(root);
   }

   for (const coll of collections) {
      if (req.includeByCollection && req.includeByCollection[coll.id] === false) {
         continue;
      }
      const inColl = allVars
         .filter(v => v.variableCollectionId === coll.id)
         .sort((a, b) => {
            const an = a.name || "";
            const bn = b.name || "";
            const ai = an.indexOf('/');
            const bi = bn.indexOf('/');
            const aUngrouped = ai === -1;
            const bUngrouped = bi === -1;
            // Ugrupperte først
            if (aUngrouped !== bUngrouped) return aUngrouped ? -1 : 1;
            const ag = aUngrouped ? "" : an.slice(0, ai).trim().toLowerCase();
            const bg = bUngrouped ? "" : bn.slice(0, bi).trim().toLowerCase();
            if (ag !== bg) return ag.localeCompare(bg);
            return an.localeCompare(bn, undefined, { sensitivity: "base" });
         });

      if (req.skipEmpty && inColl.length === 0) continue;

      const group = figma.createFrame();
      autoV(group, 8, 12);
      group.name = `${coll.name || "Untitled Collection"}`;
      // Style for collection container: white bg, 1px black @ 20% border, 16px radius
      group.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      group.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.2 }];
      group.strokeWeight = 1;
      group.cornerRadius = 16;
      group.paddingTop = group.paddingRight = group.paddingBottom = group.paddingLeft = 24;
      // La collection-kort følge barns bredde (hug)
      group.counterAxisSizingMode = "AUTO";
      // Legg group inn i root tidlig for korrekt foreldreskap
      root.appendChild(group);

      const header = makeText(group.name, { family: "Inter Variable", style: "Bold" });
      try { (header as any).name = "Collection Header"; } catch { }
      header.fontSize = 24;
      header.layoutAlign = "STRETCH";
      group.appendChild(header);

      if (!inColl.length) {
         group.appendChild(makeText("— (ingen variabler)"));
         continue;
      }

      // Header-rad med mode-navn
      const headerRow = figma.createFrame();
      headerRow.name = "Header Row";
      headerRow.layoutMode = "HORIZONTAL";
      headerRow.primaryAxisSizingMode = "AUTO";
      headerRow.counterAxisSizingMode = "FIXED";
      headerRow.counterAxisAlignItems = "CENTER";
      headerRow.itemSpacing = 12;
      headerRow.fills = [];
      headerRow.strokes = [];
      headerRow.layoutAlign = "STRETCH";
      try { (headerRow as any).layoutSizingHorizontal = "FILL"; } catch { }

      const nameHeader = makeText("Variable Name", { family: "Inter Variable", style: "Medium" });
      nameHeader.fontSize = 16;
      try { (nameHeader as any).textAutoResize = "HEIGHT"; } catch { }
      try { nameHeader.resize(240, (nameHeader as any).height || nameHeader.height); } catch { }
      try { (nameHeader as any).layoutSizingHorizontal = "FIXED"; } catch { }
      headerRow.appendChild(nameHeader);

      for (const m of coll.modes) {
         const th = makeText(m.name, { family: "Inter Variable", style: "Medium" });
         th.fontSize = 16;
         try { (th as any).textAutoResize = "HEIGHT"; } catch { }
         try { th.resize(240, (th as any).height || th.height); } catch { }
         try { (th as any).layoutSizingHorizontal = "FIXED"; } catch { }
         headerRow.appendChild(th);
      }

      // Separator under header
      const headerSep = figma.createRectangle();
      headerSep.name = "Header Divider";
      headerSep.resize(1, 1);
      headerSep.layoutAlign = "STRETCH";
      headerSep.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.2 }];
      headerSep.strokes = [];

      group.appendChild(headerRow);
      try { (headerRow as any).resizeWithoutConstraints(headerRow.width, 44); } catch { try { headerRow.resize(headerRow.width, 44); } catch { } }
      group.appendChild(headerSep);

      // Opprett container for rader (vertikal auto-layout)
      const rowsWrapper = figma.createFrame();
      rowsWrapper.name = "Rows Wrapper";
      rowsWrapper.layoutMode = "VERTICAL";
      rowsWrapper.primaryAxisSizingMode = "AUTO";
      rowsWrapper.counterAxisSizingMode = "AUTO";
      rowsWrapper.itemSpacing = 0;
      rowsWrapper.fills = [];
      rowsWrapper.strokes = [];
      rowsWrapper.layoutAlign = "STRETCH";
      // Fyll tilgjengelig bredde i containeren
      try { (rowsWrapper as any).layoutSizingHorizontal = "FILL"; } catch { }
      // Append rows container early to ensure all children are nested correctly
      group.appendChild(rowsWrapper);

      // Tabell: rader = variabler, kolonner = modes (gruppert etter første navnesegment)
      let currentGroup: string | null = null;
      for (const v of inColl) {
         const rawName = v.name || "";
         const slashIdx = rawName.indexOf('/');
         const hasGroup = slashIdx > -1;
         const groupName = hasGroup ? rawName.slice(0, slashIdx).trim() : "";
         if (hasGroup && groupName && currentGroup !== groupName) {
            currentGroup = groupName;
            const gHeader = figma.createFrame();
            gHeader.name = `Group Header: ${currentGroup}`;
            gHeader.layoutMode = "VERTICAL";
            gHeader.primaryAxisSizingMode = "AUTO";
            gHeader.counterAxisSizingMode = "AUTO";
            gHeader.itemSpacing = 4;
            gHeader.fills = [];
            gHeader.strokes = [];
            gHeader.paddingTop = 20;
            gHeader.paddingBottom = 4;

            const gLabel = makeText(currentGroup, { family: "Inter Variable", style: "Bold" });
            gLabel.fontSize = 16;
            try { (gLabel as any).textAutoResize = "HEIGHT"; } catch { }
            gHeader.appendChild(gLabel);

            rowsWrapper.appendChild(gHeader);
         }

         const row = figma.createFrame();
         autoH(row, 12, 8);
         row.name = `Row: ${normalizeVarName(v.name)}`;
         // Append row early to ensure nesting
         rowsWrapper.appendChild(row);
         // Fill width of container
         row.layoutAlign = "STRETCH";
         row.counterAxisAlignItems = "CENTER"; // vertikal sentrering av innhold i raden
         row.paddingLeft = row.paddingRight = 0;
         row.counterAxisSizingMode = "FIXED"; // fast høyde for rad
         // Sett høyden eksplisitt til 44px (ellers default ~100px)
         try { (row as any).resizeWithoutConstraints(row.width, 44); } catch { try { row.resize(row.width, 44); } catch { } }
         try { (row as any).layoutSizingHorizontal = "FILL"; } catch { }
         const nameText = makeText(normalizeVarName(v.name), { family: "Inter Variable", style: "Medium" });
         nameText.fontSize = 16;
         // Grow to share width across columns
         try { (nameText as any).layoutGrow = 1; } catch { }
         row.appendChild(nameText);
         for (const m of coll.modes) {
            const aliasTarget = findAliasTargetForMode(v, m.modeId);
            const value = resolveValueForMode(v, m.modeId);
            const cell = figma.createFrame();
            cell.name = `Cell: ${m.name}`;
            // Append cell early to avoid stray children
            row.appendChild(cell);
            // cell: swatch (om farge) + tekst
            cell.layoutMode = "HORIZONTAL";
            cell.primaryAxisSizingMode = "AUTO";
            cell.counterAxisSizingMode = "AUTO";
            cell.itemSpacing = 4;
            cell.fills = [];
            cell.strokes = [];
            // Make each column fill available width equally i bredden, men ikke høyden
            cell.layoutAlign = "CENTER"; // slik at celler har hug i høyden
            try { (cell as any).layoutSizingHorizontal = "FILL"; } catch { }
            try { (cell as any).layoutGrow = 1; } catch { }

            if (!aliasTarget) {
               const col = tryExtractColor(value);
               if (col) {
                  const sw = figma.createRectangle();
                  sw.name = "Color Swatch";
                  sw.resize(20, 20);
                  sw.cornerRadius = 6;
                  sw.fills = [{ type: "SOLID", color: { r: col.r, g: col.g, b: col.b }, opacity: col.a }];
                  sw.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.06 }];
                  cell.appendChild(sw);
               }
            }

            // Boolean chip: dot + text for clearer state
            if (!aliasTarget && typeof value === "boolean") {
               // Baseline-align contents so dot aligns with text baseline
               try { (cell as any).counterAxisAlignItems = "BASELINE"; } catch { }
               const dot = figma.createEllipse();
               dot.name = "Boolean Dot";
               dot.resize(10, 10);
               const on = value === true;
               if (on) {
                  // True: filled dot (green), no border
                  dot.fills = [{ type: "SOLID", color: { r: 0.11, g: 0.69, b: 0.38 } }];
                  dot.strokes = [];
               } else {
                  // False: no fill, gray border
                  dot.fills = [];
                  dot.strokes = [{ type: "SOLID", color: { r: 0.62, g: 0.62, b: 0.62 } }];
                  dot.strokeWeight = 1;
               }
               cell.appendChild(dot);
            }

            if (aliasTarget) {
               // Render an alias chip: [$] [Target Name]
               const chip = figma.createFrame();
               chip.name = "Alias Chip";
               chip.layoutMode = "HORIZONTAL";
               chip.primaryAxisSizingMode = "AUTO";
               chip.counterAxisSizingMode = "AUTO";
               chip.itemSpacing = 4;
               chip.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.94, b: 0.94 } }];
               chip.strokes = [];
               chip.cornerRadius = 6;
               chip.paddingLeft = chip.paddingRight = 8;
               chip.paddingTop = 2;
               chip.paddingBottom = 4;
               // Append chip before creating its children to prevent stray text nodes
               cell.appendChild(chip);

               const dollar = makeText("$", { family: "Roboto Mono", style: "Italic" });
               dollar.name = "Alias Dollar";
               dollar.fontSize = 16;
               dollar.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.5 }];
               // Vis collection-navn foran alias-navn kun når aliaset peker til annen gruppe (første navnesegment) eller annen collection
               const aliasRaw = aliasTarget.name || "";
               const currRaw = v.name || "";
               const aliasGroup = (aliasRaw.split('/')[0] || '').trim().toLowerCase();
               const currGroup = (currRaw.split('/')[0] || '').trim().toLowerCase();
               let aliasLabel = normalizeVarName(aliasRaw);
               try {
                  if (aliasTarget.variableCollectionId !== v.variableCollectionId || aliasGroup !== currGroup) {
                     const aliasColl = figma.variables.getVariableCollectionById(aliasTarget.variableCollectionId);
                     const collName = aliasColl ? (aliasColl.name || "Untitled Collection") : "Untitled Collection";
                     aliasLabel = `${collName}/${aliasLabel}`;
                  }
               } catch {}
               const aliasName = makeText(aliasLabel, { family: "Roboto Mono", style: "Regular" });
               aliasName.name = "Alias Name";
               aliasName.fontSize = 16;
               try { (aliasName as any).textAutoResize = "HEIGHT"; } catch { }
               chip.appendChild(dollar);
               chip.appendChild(aliasName);
            } else {
               const valueText = makeText(valueToString(value), { family: "Roboto Mono", style: "Regular" });
               valueText.name = "Value";
               valueText.fontSize = 16;
               valueText.layoutAlign = "STRETCH";
               try { (valueText as any).layoutSizingHorizontal = "FILL"; } catch { }
               try { (valueText as any).textAutoResize = "HEIGHT"; } catch { }
               cell.appendChild(valueText);
            }
         }

         // Bunn-border som separator (1px sort @ 20%) – gjenbruk stil via helper
         rowsWrapper.appendChild(makeDivider());
      }
   }

   figma.currentPage.appendChild(root);
   figma.viewport.scrollAndZoomIntoView([root]);
   figma.notify("Variabler eksportert som frames.");
}

function postBootstrap() {
   const snapshot = getCollectionsSnapshot();
   const payload = { type: "BOOTSTRAP", collections: snapshot };
   console.log("[MAIN] postMessage BOOTSTRAP", { collections: snapshot.length });
   try {
      // Explicit origin for stricter runtimes
      // @ts-ignore - postMessage options accepted at runtime
      figma.ui.postMessage(payload, { origin: "*" });
   } catch {
      figma.ui.postMessage(payload as any);
   }
}

figma.ui.onmessage = async (msg: any) => {
   console.log("[MAIN] onmessage", msg);
   if (msg && msg.type === "UI_LOG") {
      const level = (msg.level || "log").toLowerCase();
      const text = `[UI] ${JSON.stringify(msg.args)}`;
      try {
         if (level === "error") console.error(text);
         else if (level === "warn") console.warn(text);
         else console.log(text);
      } catch { console.log(text); }
      return;
   }
   if (msg && msg.type === "UI_PING") {
      // UI bekrefter at den er klar – send bootstrap igjen i tilfelle race
      postBootstrap();
   }
   if (msg && msg.type === "EXPORT_REQUEST") {
      try {
         await renderExport(msg.data as ExportRequest);
         try {
            // @ts-ignore
            figma.ui.postMessage({ type: "EXPORT_DONE" }, { origin: "*" });
         } catch {
            figma.ui.postMessage({ type: "EXPORT_DONE" } as any);
         }
      } catch (err) {
         try {
            // @ts-ignore
            figma.ui.postMessage({ type: "EXPORT_ERROR", error: String(err) }, { origin: "*" });
         } catch {
            figma.ui.postMessage({ type: "EXPORT_ERROR", error: String(err) } as any);
         }
      }
   }
};

function showUI() {
   console.log("[MAIN] showUI");
   figma.showUI(__html__, { width: 520, height: 560, themeColors: true });
   // Fallback: send BOOTSTRAP right away and once more shortly after.
   // UI will also trigger a UI_PING which we handle separately.
   postBootstrap();
   setTimeout(() => {
      try { postBootstrap(); } catch (_) { }
   }, 100);
}

showUI();
