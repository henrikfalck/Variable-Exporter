import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const common = {
  bundle: true,
  platform: "browser",
  target: ["es2018"],
  minify: true,
  sourcemap: false,            // <- slå av maps (kan skape rare feilmeldinger i Figma)
  legalComments: "none",
  logLevel: "info"
};

await Promise.all([
  build({
    ...common,
    entryPoints: { code: "src/index.ts" },
    format: "iife",            // <- VIKTIG
    outdir: "dist"
  }),
  build({
    ...common,
    entryPoints: { ui: "src/ui.ts" },
    format: "iife",            // <- VIKTIG
    outdir: "dist"
  })
]);

mkdirSync("dist", { recursive: true });
// Inline ui.js into ui.html to avoid script loading issues in Figma's data: UI
try {
  const html = readFileSync("src/ui.html", "utf8");
  const js = readFileSync("dist/ui.js", "utf8");
  const marker = '<script defer src="./ui.js"></script>';
  let out = html;
  if (html.includes(marker)) {
    out = html.replace(marker, `<script>${js}\n</script>`);
  } else if (html.includes("./ui.js")) {
    // Fallback: remove any script tag that points to ./ui.js (coarse), then append inline before </body>
    out = html.replace(/<script[^>]*src=(\"|')\.\/ui\.js\1[^>]*><\/script>/i, "");
    out = out.replace(/<\/body>/i, `<script>${js}\n</script>\n</body>`);
  } else {
    // As last resort, inject before </body>
    out = html.replace(/<\/body>/i, `<script>${js}\n</script>\n</body>`);
  }
  writeFileSync("dist/ui.html", out, "utf8");
} catch (e) {
  // Fallback: copy as-is if inline fails
  copyFileSync("src/ui.html", "dist/ui.html");
}
console.log("Built → dist/code.js, dist/ui.js, dist/ui.html");
