/*
 * Black Month in Stripe anlegen: Produkt "Black Month: 6 Monate Gym", Einmalpreis 149 €, Payment Link mit Karte (inkl. Apple Pay / Google Pay) und SEPA.
 * Idempotent über Metadaten skill_offer=black-month. Gibt den Payment Link aus, der in .env unter VITE_STRIPE_LINK_BLACKMONTH eingetragen wird.
 *
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-blackmonth.mjs            # anlegen / vorhandenes ausgeben
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-blackmonth.mjs --dry-run  # nur zeigen
 * Der Schlüssel wird nie ausgegeben. Nach dem 30.11.2026 den Link in Stripe deaktivieren (die Seite blendet den Knopf dann ohnehin aus).
 */
const KEY = process.env.STRIPE_SECRET_KEY || "";
const DRY = process.argv.includes("--dry-run");
if (!KEY) { console.error("STRIPE_SECRET_KEY fehlt. Aufruf: STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-blackmonth.mjs"); process.exit(1); }
const SITE = "https://skill-studios.com";

function encode(v, prefix = "", out = []) {
  if (v == null) return out;
  if (Array.isArray(v)) v.forEach((x, i) => encode(x, `${prefix}[${i}]`, out));
  else if (typeof v === "object") Object.entries(v).forEach(([k, x]) => encode(x, prefix ? `${prefix}[${k}]` : k, out));
  else out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
  return out;
}
async function stripe(method, path, params) {
  const body = params ? encode(params).join("&") : "";
  const r = await fetch("https://api.stripe.com/v1" + path + (method === "GET" && body ? "?" + body : ""), { method, headers: { Authorization: `Bearer ${KEY}`, "Stripe-Version": "2024-06-20", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: method === "POST" ? body : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${data?.error?.message || r.status}`);
  return data;
}
const post = (path, params) => DRY ? (console.log("  [dry-run] POST", path, JSON.stringify(params)), { id: "(neu)", url: "(neu)" }) : stripe("POST", path, params);

try {
  const found = await stripe("GET", "/products/search", { query: "active:'true' AND metadata['skill_offer']:'black-month'" });
  let product = found.data?.[0];
  if (product) console.log(`Produkt vorhanden: ${product.name} (${product.id})`);
  else { product = await post("/products", { name: "Black Month: 6 Monate Gym", description: "ONLY GYM. 6 Monate Gym bei SKILL CGN Köln für 149 € Einmalzahlung. Aktion 2.11. bis 30.11.2026. Keine Classes, kein Abo.", metadata: { skill_offer: "black-month" } }); console.log(`Produkt angelegt: ${product.id}`); }

  let price = null;
  if (product.id !== "(neu)") { const ps = await stripe("GET", "/prices", { product: product.id, active: true, limit: 10 }); price = ps.data.find(p => p.unit_amount === 14900 && !p.recurring); }
  if (price) console.log(`Preis vorhanden: 149 € einmalig (${price.id})`);
  else { price = await post("/prices", { product: product.id, currency: "eur", unit_amount: 14900, nickname: "Black Month 149 € einmalig", metadata: { skill_offer: "black-month" } }); console.log(`Preis angelegt: ${price.id}`); }

  let link = null;
  if (price.id !== "(neu)") { const ls = await stripe("GET", "/payment_links", { active: true, limit: 100 }); link = ls.data.find(l => l.metadata?.product_id === "black-month"); }
  if (link) console.log(`Payment Link vorhanden: ${link.url} (${link.id})`);
  else {
    link = await post("/payment_links", {
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_types: ["card", "sepa_debit"],
      customer_creation: "always",
      phone_number_collection: { enabled: true },
      billing_address_collection: "auto",
      after_completion: { type: "redirect", redirect: { url: `${SITE}/shop/danke?p=black-month&session_id={CHECKOUT_SESSION_ID}` } },
      metadata: { purchase_type: "shop", product_id: "black-month" },
      payment_intent_data: { description: "Black Month: 6 Monate Gym, SKILL CGN", metadata: { product_id: "black-month" } },
    });
    console.log(`Payment Link angelegt: ${link.url} (${link.id})`);
  }
  console.log("\nIn .env eintragen, dann npm run deploy:");
  console.log(`VITE_STRIPE_LINK_BLACKMONTH=${link.url}`);
  console.log("Apple Pay und Google Pay erscheinen im Stripe-Checkout automatisch bei Zahlungsart Karte, wenn im Stripe-Dashboard unter Zahlungsmethoden aktiviert.");
} catch (e) { console.error("Fehler:", e.message); process.exit(1); }
