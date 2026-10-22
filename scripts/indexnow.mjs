/* IndexNow: nach jedem Deploy alle URLs der Sitemap an api.indexnow.org melden (Bing, Yandex, Naver, Seznam; Copilot/ChatGPT-Suche lesen den Bing-Index).
   Aufruf: node scripts/indexnow.mjs   (läuft automatisch in "npm run deploy"). Key-Datei liegt unter public/<key>.txt. */
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const KEY = "71e14708c82f955bc7bf784108cc1bcb";
const HOST = "skill-studios.com";
const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!urls.length) { console.error("IndexNow: keine URLs in public/sitemap.xml"); process.exit(1); }
const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls };
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
console.log(`IndexNow: ${urls.length} URLs gemeldet, Antwort ${r.status} ${r.status === 200 || r.status === 202 ? "OK" : await r.text()}`);
