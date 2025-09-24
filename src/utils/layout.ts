/**
 * Configure a frame for vertical auto‑layout with consistent spacing + padding and no fills/strokes.
 */
export function autoV(node: FrameNode, spacing = 8, padding = 12) {
   node.layoutMode = "VERTICAL";
   node.primaryAxisSizingMode = "AUTO";
   node.counterAxisSizingMode = "AUTO";
   node.itemSpacing = spacing;
   node.paddingTop = node.paddingBottom = node.paddingLeft = node.paddingRight = padding;
   node.fills = [];
   node.strokes = [];
}

/**
 * Configure a frame for horizontal auto‑layout with consistent spacing + padding and no fills/strokes.
 */
export function autoH(node: FrameNode, spacing = 12, padding = 8) {
   node.layoutMode = "HORIZONTAL";
   node.primaryAxisSizingMode = "AUTO";
   node.counterAxisSizingMode = "AUTO";
   node.itemSpacing = spacing;
   node.paddingTop = node.paddingBottom = node.paddingLeft = node.paddingRight = padding;
   node.fills = [];
   node.strokes = [];
}
