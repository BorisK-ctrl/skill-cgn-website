/* Stripe REST ohne SDK (Formular-Kodierung, Bearer-Key). Schlüssel STRIPE_SECRET_KEY aus Netlify.
   API-Version fest, damit latest_invoice.payment_intent beim Abo-Anlegen verfügbar bleibt. */
const KEY = process.env.STRIPE_SECRET_KEY || "";
export const stripeConfigured = () => !!KEY;
/** Stripe-Preis je Angebot (Abo, 39 € alle vier Wochen). Fehlt das Angebot, gibt es keinen Express-Weg. */
export const PRICES: Record<string, string> = {
  "START 39": process.env.STRIPE_PRICE_START39 || "price_1UKJ06HMQZbugHGZAWBPGBNv",
  "BACK 39": process.env.STRIPE_PRICE_BACK39 || process.env.STRIPE_PRICE_START39 || "price_1UKJ06HMQZbugHGZAWBPGBNv", // gleicher Preis, bis Boris ein BACK39-Produkt anlegt
  /* Neue Tarife: je Laufzeit ein Stripe-Preis (Abo alle 4 Wochen). Leer = kein Express-Weg, nur SEPA. */
  "SKILL Mitgliedschaft|12": process.env.STRIPE_PRICE_MITGLIEDSCHAFT_12 || "",
  "SKILL Mitgliedschaft|1": process.env.STRIPE_PRICE_MITGLIEDSCHAFT_1 || "",
  "SKILL Unlimited|12": process.env.STRIPE_PRICE_UNLIMITED_12 || "",
  "SKILL Unlimited|1": process.env.STRIPE_PRICE_UNLIMITED_1 || "",
};
/** Preis je Angebot und Laufzeit; Angebote ohne Laufzeit-Preise (START 39, BACK 39) haben einen Preis. */
export const priceFor = (offerName: string, months?: number) => PRICES[`${offerName}|${months === 12 ? 12 : 1}`] || PRICES[offerName] || "";

function encode(v: unknown, prefix = "", out: string[] = []): string[] {
  if (v == null) return out;
  if (Array.isArray(v)) v.forEach((x, i) => encode(x, `${prefix}[${i}]`, out));
  else if (typeof v === "object") Object.entries(v as Record<string, unknown>).forEach(([k, x]) => encode(x, prefix ? `${prefix}[${k}]` : k, out));
  else out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
  return out;
}
export async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  const body = params ? encode(params).join("&") : "";
  const url = "https://api.stripe.com/v1" + path + (method === "GET" && body ? "?" + body : "");
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${KEY}`, "Stripe-Version": "2024-06-20", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: method === "POST" ? body : undefined });
  let data: any = {}; try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}
