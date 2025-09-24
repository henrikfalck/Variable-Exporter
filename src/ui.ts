import type { CollectionInfo, ExportRequest } from "./types";

// UI entrypoint (minimal)

// (types from main messages are handled dynamically; explicit union removed)

// Minimal UI state: current collections and which ones to include on export
let state: { collections: CollectionInfo[]; includeByCollection: Record<string, boolean> } = {
   collections: [],
   includeByCollection: {}
};

const $list = document.getElementById("list")!;
const $export = document.getElementById("export") as HTMLButtonElement;
const $useDefault = document.getElementById("useDefault") as HTMLButtonElement;
const $skipEmpty = document.getElementById("skipEmpty") as HTMLInputElement;
console.log("[UI] wired elements", { hasList: !!$list, hasExport: !!$export, hasUseDefault: !!$useDefault, hasSkipEmpty: !!$skipEmpty });

/** Enable/disable main controls during export/bootstrap. */
function setBusy(busy: boolean) {
   $export.disabled = busy;
   $useDefault.disabled = busy;
}

/**
 * Render the list of collections with an "include" checkbox per collection.
 */
function render() {
   $list.innerHTML = "";
   if (!state.collections || state.collections.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Ingen lokale Variable Collections funnet i dette dokumentet.";
      $list.appendChild(empty);
      return;
   }
   for (const c of state.collections) {
      const card = document.createElement("div");
      card.className = "card";

      const h = document.createElement("h3");
      h.textContent = `${c.name}`;
      card.appendChild(h);

      const meta = document.createElement("div");
      meta.className = "hint";
      meta.textContent = `${c.variableCount} variabler · ${c.modes.length} modes`;
      card.appendChild(meta);

      const includeLabel = document.createElement("label");
      includeLabel.className = "checkbox";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.includeByCollection[c.id] !== false;
      cb.onchange = () => { state.includeByCollection[c.id] = cb.checked; };
      const span = document.createElement("span");
      span.textContent = "Inkluder i eksport";
      includeLabel.appendChild(cb);
      includeLabel.appendChild(span);
      card.appendChild(includeLabel);
      $list.appendChild(card);
   }
}

function extractMessage(event: any): any {
   const raw = event && event.data;
   return raw && raw.pluginMessage ? raw.pluginMessage : raw;
}

function handleMessage(msg: any) {
   if (!msg || !msg.type) return;
   if (msg.type === "BOOTSTRAP") {
      const collections = (msg.collections || []) as CollectionInfo[];
      state.collections = collections;
      const next: Record<string, boolean> = {};
      for (let i = 0; i < collections.length; i++) {
         const c = collections[i];
         next[c.id] = state.includeByCollection[c.id] !== false;
      }
      state.includeByCollection = next;
      $export.textContent = "Eksporter variabler";
      setBusy(false);
      render();
   } else if (msg.type === "EXPORT_DONE" || msg.type === "EXPORT_ERROR") {
      setBusy(false);
      $export.textContent = "Eksporter variabler";
   }
}

// Primary message handler — receives messages posted by main (plugin side)
window.onmessage = (event) => {
   const msg = extractMessage(event);
   console.log("[UI] window.onmessage", msg);
   handleMessage(msg);
};

// Secondary message listener (some runtimes dispatch here)
// (no secondary listener)

(function pingMain() {
   // Bekrefter at UI-iframe lever og kan snakke med main
   parent.postMessage({ pluginMessage: { type: "UI_PING" } }, "*");
   // Fallback ping etter kort delay
   setTimeout(() => parent.postMessage({ pluginMessage: { type: "UI_PING" } }, "*"), 50);
})();

$useDefault.onclick = () => {
   for (const c of state.collections) state.includeByCollection[c.id] = true;
   render();
};

$export.onclick = () => {
   console.log("[UI] click EXPORT", { skipEmpty: $skipEmpty.checked, includeKeys: Object.keys(state.includeByCollection).length });
   const payload: ExportRequest = {
      includeByCollection: state.includeByCollection,
      skipEmpty: $skipEmpty.checked
   };
   setBusy(true);
   $export.textContent = "Eksporterer…";
   parent.postMessage({ pluginMessage: { type: "EXPORT_REQUEST", data: payload } }, "*");
};
