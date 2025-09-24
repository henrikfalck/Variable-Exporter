import type { CollectionInfo, ExportRequest } from "./types";

console.log("[UI] boot");
window.addEventListener("error", (e) => {
   try { console.error("[UI] error", e?.message || e); } catch {}
});
window.addEventListener("unhandledrejection", (e: any) => {
   try { console.error("[UI] unhandledrejection", e?.reason || e); } catch {}
});

// Relay UI console logs to main so they appear in Figma console
(() => {
   const levels: (keyof Console)[] = ["log", "info", "warn", "error"];
   for (const lvl of levels) {
      const orig = console[lvl] as any;
      (console as any)[lvl] = function (...args: any[]) {
         try { parent.postMessage({ pluginMessage: { type: "UI_LOG", level: String(lvl), args } }, "*"); } catch {}
         try { orig.apply(console, args); } catch {}
      } as any;
   }
})();

// (types from main messages are handled dynamically; explicit union removed)

let state: { collections: CollectionInfo[]; includeByCollection: Record<string, boolean> } = {
   collections: [],
   includeByCollection: {}
};

const $list = document.getElementById("list")!;
const $export = document.getElementById("export") as HTMLButtonElement;
const $useDefault = document.getElementById("useDefault") as HTMLButtonElement;
const $skipEmpty = document.getElementById("skipEmpty") as HTMLInputElement;
console.log("[UI] wired elements", { hasList: !!$list, hasExport: !!$export, hasUseDefault: !!$useDefault, hasSkipEmpty: !!$skipEmpty });

function setBusy(busy: boolean) {
   $export.disabled = busy;
   $useDefault.disabled = busy;
}

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
      console.log("[UI] BOOTSTRAP collections", (msg.collections && msg.collections.length) || 0);
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
      // Ack back to main for visibility when UI console isn't open
      parent.postMessage({ pluginMessage: { type: "UI_READY_ACK", collections: collections.length } }, "*");
   } else if (msg.type === "EXPORT_DONE" || msg.type === "EXPORT_ERROR") {
      setBusy(false);
      $export.textContent = "Eksporter variabler";
   }
}

window.onmessage = (event) => {
   const msg = extractMessage(event);
   console.log("[UI] window.onmessage", msg);
   handleMessage(msg);
};

window.addEventListener("message", (event) => {
   const msg = extractMessage(event);
   console.log("[UI] addEventListener message", msg);
   handleMessage(msg);
});

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
