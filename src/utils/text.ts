export async function loadFonts() {
   const fonts: FontName[] = [
      // Inter (legacy)
      { family: "Inter", style: "Regular" },
      { family: "Inter", style: "Medium" },
      // Inter Variable (for headings and names)
      { family: "Inter Variable", style: "Regular" },
      { family: "Inter Variable", style: "Medium" },
      { family: "Inter Variable", style: "Bold" },
      // Roboto for alias chip labels
      { family: "Roboto", style: "Regular" },
      { family: "Roboto", style: "Medium" },
      // Monospace for values and alias chip
      { family: "Roboto Mono", style: "Regular" },
      { family: "Roboto Mono", style: "Italic" }
   ];
   for (const f of fonts) { try { await figma.loadFontAsync(f); } catch { } }
}

export function makeText(characters: string, font: FontName = { family: "Inter", style: "Regular" }) {
   const t = figma.createText();
   t.fontName = font;
   t.characters = characters;
   t.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
   return t;
}
