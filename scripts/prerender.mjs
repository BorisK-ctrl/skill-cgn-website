/* Prerendering: schreibt für jede Route dist/<pfad>/index.html mit gerendertem HTML, Titel, Description, Robots, Canonical.
   Läuft nach `vite build` (Client) und `vite build --ssr` (Server-Bundle in dist-ssr). */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, process.env.DIST_DIR || "dist");
const ssrDir = path.join(root, "dist-ssr");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const { render } = await import(pathToFileURL(path.join(ssrDir, "entry-server.js")).href);
const { ROUTES, SITE_URL } = await import(pathToFileURL(path.join(ssrDir, "entry-server.js")).href);

const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function fill(html, appHtml, r, jsonLd = []) {
  const ld = jsonLd.map(j => `<script type="application/ld+json">${j.replace(/<\//g, "<\\/")}</script>`).join("\n");
  const url = SITE_URL + (r.path === "/404" ? "/" : r.path);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(r.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(r.description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(r.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(r.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE_URL}${r.image || "/img/og.jpg"}">`)
    .replace('<meta name="theme-color"', `<meta name="robots" content="${r.robots || "index,follow"}">\n<link rel="canonical" href="${url}">\n<meta name="theme-color"`)
    .replace('</head>', `${ld ? ld + "\n" : ""}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
}

let n = 0;
for (const r of ROUTES) {
  const { html: appHtml, jsonLd } = await render(r.path === "/404" ? "/__not_found__" : r.path);
  const html = fill(template, appHtml, r, jsonLd);
  // Als <route>.html schreiben: Netlify liefert /start39 dann ohne Trailing-Slash-Redirect aus
  const out = r.path === "/" ? path.join(dist, "index.html") : path.join(dist, r.path.slice(1) + ".html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  n++;
}
fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`prerendered ${n} routes`);
