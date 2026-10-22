/* Build-Warnung: fehlende Magicline-IDs in src/lib/magicline.ts (OFFERS). Bricht den Build nicht ab. */
import fs from "node:fs";
import path from "node:path";
const src = fs.readFileSync(path.resolve(import.meta.dirname, "../src/lib/magicline.ts"), "utf8");
const block = src.slice(src.indexOf("export const OFFERS"), src.indexOf("} as const;", src.indexOf("export const OFFERS")));
const warnings = [];
for (const m of block.matchAll(/(\w+): \{ bundle: "([^"]+)"[\s\S]*?ids: (\{[^}]*\}|null)/g)) {
  const [, key, title, ids] = m; if (ids === "null") continue;
  const missing = ["rateBundleId", "term12Id", "term1Id"].filter(f => new RegExp(`${f}: null`).test(ids));
  if (missing.length) warnings.push(`${title} (${key}): ${missing.join(", ")}`);
}
if (warnings.length) { console.warn("\nWARNUNG Magicline-IDs fehlen in src/lib/magicline.ts:"); for (const w of warnings) console.warn("  - " + w); console.warn("  Bis dahin werden die Angebote über den Namen im rate-bundle gesucht; fehlt auch der, zeigt der Checkout einen Platzhalter.\n"); }
else console.log("Magicline-IDs vollständig.");
