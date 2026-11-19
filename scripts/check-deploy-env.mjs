/* Vor `npm run deploy` vom eigenen Rechner: ohne VITE_GADS_ID und VITE_GADS_LABEL baut Vite die Google-Ads-Conversions still aus
   (src/lib/gads.ts). Netlify baut mit seinen eigenen Variablen; diese Prüfung läuft nur beim Deploy von Hand. */
import { loadEnv } from "vite";
const env = { ...loadEnv("production", process.cwd(), "VITE_"), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("VITE_"))) };
const id = (env.VITE_GADS_ID || "").trim(), label = (env.VITE_GADS_LABEL || "").trim();
const bad = [];
if (!/^AW-\d{6,}$/.test(id)) bad.push(`VITE_GADS_ID ist "${id || "leer"}"`);
if (!label || /^x+$/i.test(label)) bad.push(`VITE_GADS_LABEL ist "${label || "leer"}"`);
if (bad.length) {
  console.error(`Deploy abgebrochen: ${bad.join(", ")}. Ohne beide Werte zählt Google Ads keine Käufe mehr.\nWerte stehen in Netlify (Environment variables) und in .env.production.`);
  process.exit(1);
}
console.log(`Google Ads ok: ${id}`);
