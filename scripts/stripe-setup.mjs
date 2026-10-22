/*
 * Stripe einrichten für die neuen Tarife und die Personal-Training-Texte. Einmalig, idempotent (läuft mehrfach ohne Doppelungen).
 *
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs            # legt an / aktualisiert
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --dry-run  # zeigt nur, was passieren würde
 *
 * Was passiert:
 *  1. Produkte "SKILL Mitgliedschaft" und "SKILL Unlimited" (Metadaten skill_offer), je zwei Abo-Preise alle vier Wochen:
 *     12 Monate 89 € / 129 €, monatlich 109 € / 149 €. Abrechnungsrhythmus wird vom bestehenden START-39-Preis übernommen.
 *  2. Personal-Training-Produkte: Name und Beschreibung auf 45 bzw. 60 Minuten (Preise bleiben, Payment Links bleiben gültig).
 *  3. Ausgabe der vier Preis-IDs und der netlify-Befehle für STRIPE_PRICE_* und VITE_EXPRESS_OFFERS.
 * Der Schlüssel wird nie ausgegeben.
 */
const KEY = process.env.STRIPE_SECRET_KEY || "";
const DRY = process.argv.includes("--dry-run");
if (!KEY) { console.error("STRIPE_SECRET_KEY fehlt. Aufruf: STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs"); process.exit(1); }

const START39_PRICE = process.env.STRIPE_PRICE_START39 || "price_1UKJ06HMQZbugHGZAWBPGBNv";
const OFFERS = [
  { name: "SKILL Mitgliedschaft", key: "mitgliedschaft", env: "MITGLIEDSCHAFT", desc: "Gym ohne Limit, 6 Classes je vier Wochen, 3D Scan zum Start und alle 12 Wochen, Plan, Parken 2 mal pro Woche. Abrechnung alle vier Wochen.", prices: { 12: 8900, 1: 10900 } },
  { name: "SKILL Unlimited", key: "unlimited", env: "UNLIMITED", desc: "Gym ohne Limit, alle Classes, 3D Scan alle 8 Wochen, Coach Gespräch einmal im Monat, Parken 3 mal pro Woche. Abrechnung alle vier Wochen.", prices: { 12: 12900, 1: 14900 } },
];
/* Personal Training: Produkt wird über den Namen gefunden (enthält "Personal Training" oder den Kartennamen) und über den Preis in Cent abgesichert. */
const PT = [
  { match: /einzelstunde/i, amount: 12000, name: "Personal Training Einzelstunde", desc: "1 × 60 Minuten 1:1 mit Boris. Assessment, Anamnese und Trainingsprogramm inklusive. Erfolgsversprechen, sonst Geld zurück." },
  { match: /5er/i, amount: 50000, name: "Personal Training 5er-Karte", desc: "5 × 45 Minuten 1:1 mit Boris. Assessment, Anamnese, Trainingsprogramm und Check-ins inklusive. Erfolgsversprechen, sonst Geld zurück." },
  { match: /10er/i, amount: 90000, name: "Personal Training 10er-Karte", desc: "10 × 45 Minuten 1:1 mit Boris. Assessment, Anamnese, Trainingsprogramm, Check-ins und Scan inklusive. Erfolgsversprechen, sonst Geld zurück." },
];

function encode(v, prefix = "", out = []) {
  if (v == null) return out;
  if (Array.isArray(v)) v.forEach((x, i) => encode(x, `${prefix}[${i}]`, out));
  else if (typeof v === "object") Object.entries(v).forEach(([k, x]) => encode(x, prefix ? `${prefix}[${k}]` : k, out));
  else out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
  return out;
}
async function stripe(method, path, params) {
  const body = params ? encode(params).join("&") : "";
  const r = await fetch("https://api.stripe.com/v1" + path + (method === "GET" && body ? "?" + body : ""), {
    method, headers: { Authorization: `Bearer ${KEY}`, "Stripe-Version": "2024-06-20", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: method === "POST" ? body : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${data?.error?.message || r.status}`);
  return data;
}
const post = (path, params) => DRY ? (console.log("  [dry-run] POST", path, JSON.stringify(params)), { id: "(neu)" }) : stripe("POST", path, params);

/* 1) Abrechnungsrhythmus von START 39 übernehmen */
const ref = await stripe("GET", `/prices/${START39_PRICE}`).catch(e => { console.error("Stripe antwortet nicht:", e.message); process.exit(1); });
const recurring = ref.recurring ? { interval: ref.recurring.interval, interval_count: ref.recurring.interval_count } : { interval: "week", interval_count: 4 };
console.log(`START 39 Referenzpreis: ${ref.unit_amount / 100} ${ref.currency.toUpperCase()} je ${recurring.interval_count} ${recurring.interval}, livemode=${ref.livemode}`);

/* 2) Produkte und Preise, idempotent über Metadaten */
const env = [];
for (const o of OFFERS) {
  const found = await stripe("GET", "/products/search", { query: `active:'true' AND metadata['skill_offer']:'${o.key}'` });
  let product = found.data?.[0];
  if (product) console.log(`Produkt vorhanden: ${product.name} (${product.id})`);
  else { product = await post("/products", { name: o.name, description: o.desc, metadata: { skill_offer: o.key } }); console.log(`Produkt angelegt: ${o.name} (${product.id})`); }
  for (const months of [12, 1]) {
    const nick = months === 12 ? "12 Monate" : "Monatlich kündbar";
    let price = null;
    if (product.id !== "(neu)") {
      const ps = await stripe("GET", "/prices", { product: product.id, active: true, limit: 20 });
      price = ps.data.find(p => p.metadata?.months === String(months) && p.unit_amount === o.prices[months]);
    }
    if (price) console.log(`  Preis vorhanden: ${nick} ${price.unit_amount / 100} € (${price.id})`);
    else { price = await post("/prices", { product: product.id, currency: "eur", unit_amount: o.prices[months], recurring, nickname: `${o.name} · ${nick}`, metadata: { months: String(months), skill_offer: o.key } }); console.log(`  Preis angelegt: ${nick} ${o.prices[months] / 100} € (${price.id})`); }
    env.push([`STRIPE_PRICE_${o.env}_${months}`, price.id]);
  }
}

/* 3) Personal Training: Name und Beschreibung */
const all = await stripe("GET", "/products", { active: true, limit: 100 });
for (const pt of PT) {
  const cands = all.data.filter(p => pt.match.test(p.name) || (p.description && pt.match.test(p.description)));
  let product = null;
  for (const c of cands) {
    const ps = await stripe("GET", "/prices", { product: c.id, active: true, limit: 10 });
    if (ps.data.some(p => p.unit_amount === pt.amount)) { product = c; break; }
  }
  if (!product) { console.log(`PT: kein Produkt für "${pt.name}" (${pt.amount / 100} €) gefunden, bitte im Dashboard prüfen.`); continue; }
  if (product.name === pt.name && product.description === pt.desc) { console.log(`PT unverändert: ${pt.name}`); continue; }
  await post(`/products/${product.id}`, { name: pt.name, description: pt.desc });
  console.log(`PT aktualisiert: ${product.name} → ${pt.name}`);
}

/* 4) Netlify-Befehle */
console.log("\nNetlify setzen (keine Geheimnisse, nur Preis-IDs):");
for (const [k, v] of env) console.log(`  netlify env:set ${k} ${v}`);
console.log(`  netlify env:set VITE_EXPRESS_OFFERS "START 39,BACK 39,SKILL Mitgliedschaft,SKILL Unlimited"`);
console.log("Danach: npm run build && netlify deploy --prod --dir=dist (VITE_* wird beim Build eingebacken).");
if (DRY) console.log("\nDry-run: nichts geändert.");
