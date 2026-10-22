/* POST /api/stripe/express: Express-Abschluss mit Apple Pay, Google Pay oder Link direkt auf /start39.
   { action: "subscribe", token, offerName, rateBundleTermId, startDate, dob, signatureSvgBase64, name, email, phone, address, … }
     → Checkout-Datensatz + Magicline-Interessent + Stripe-Kunde + Abo (default_incomplete) → { clientSecret, subscriptionId }
   { action: "complete", token } → prüft bei Stripe, ob das Abo bezahlt ist, legt dann den Magicline-Vertrag an → { done, contractId, customerNumber }
   Idempotent: ein zweites "complete" liefert den vorhandenen Vertrag. Unterschrift wird nach der Vertragsanlage gelöscht. */
import type { Config } from "@netlify/functions";
import { json, normEmail, validEmail } from "./lib/util";
import { getCheckoutLead, saveCheckoutLead, type CheckoutLead } from "./lib/store";
import { createLeadServer } from "./lib/connect";
import { stripe, stripeConfigured, priceFor } from "./lib/stripe";
import { completeMembership } from "./lib/membership";

const TOKEN = /^[a-z0-9]{16,48}$/;
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
/** "Herzogstraße 16-20" → Straße + Hausnummer; ohne Nummer bleibt die Nummer leer (Magicline akzeptiert das). */
export function splitStreet(line1: string, line2 = ""): { street: string; houseNumber: string } {
  const m = line1.trim().match(/^(.*?)[\s,]+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+\s?[a-zA-Z]?)?)$/);
  if (m) return { street: m[1].trim(), houseNumber: m[2].replace(/\s+/g, "") };
  const m2 = line2.trim().match(/^\d+\s?[a-zA-Z]?$/);
  return { street: line1.trim(), houseNumber: m2 ? line2.trim() : "" };
}
export function splitName(name: string): { firstName: string; lastName: string } {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return { firstName: "", lastName: "" };
  return { firstName: p[0], lastName: p.slice(1).join(" ") || p[0] };
}
const age = (dob: string) => (Date.now() - new Date(dob + "T12:00:00").getTime()) / 31557600000;

async function subscribe(b: any, token: string, req: Request) {
  const offerName = str(b.offerName, 40); const price = priceFor(offerName, Number(b.months));
  if (!price) return json({ error: "Für dieses Angebot gibt es keinen Express-Abschluss" }, 400);
  /* Felder direkt aus dem Browser (Wallet plus Nachfrage); ältere Aufrufe schicken name/address, daraus ableiten */
  const fromName = splitName(str(b.name, 120)); const a = b.address && typeof b.address === "object" ? b.address : {}; const fromAddr = splitStreet(str(a.line1, 120), str(a.line2, 40));
  const firstName = str(b.firstName, 80) || fromName.firstName, lastName = str(b.lastName, 80) || (str(b.name, 120).trim().split(/\s+/).length > 1 ? fromName.lastName : "");
  const email = normEmail(str(b.email, 120)); const phone = str(b.phone, 40);
  const street = str(b.street, 120) || fromAddr.street, houseNumber = str(b.houseNumber, 20) || fromAddr.houseNumber;
  const zip = str(b.zip, 10) || str(a.postal_code, 10), city = str(b.city, 80) || str(a.city, 80), country = (str(b.country, 2) || str(a.country, 2)).toUpperCase() || "DE";
  const dob = str(b.dob, 10); const sig = String(b.signatureSvgBase64 || "").slice(0, 200000);
  const termId = Number(b.rateBundleTermId); const startDate = str(b.startDate, 10);
  /* Vollständigkeit vor allem anderen: fehlt ein Magicline-Pflichtfeld, bekommt der Browser die Liste und fragt nach */
  const missing: string[] = [];
  if (!firstName) missing.push("firstName"); if (!lastName) missing.push("lastName"); if (!validEmail(email)) missing.push("email"); if (phone.replace(/\D/g, "").length < 8) missing.push("phone");
  if (!street) missing.push("street"); if (!houseNumber) missing.push("streetNumber"); if (!/^\d{5}$/.test(zip)) missing.push("zip"); if (!city) missing.push("city");
  if (missing.length) return json({ error: "Angaben unvollständig", missing }, 400);
  if (!termId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return json({ error: "Angebot oder Startdatum fehlt" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || age(dob) < 18) return json({ error: "Onlineabschluss nur ab 18 Jahren" }, 400);
  if (sig.length < 40) return json({ error: "Unterschrift fehlt" }, 400);
  const path = b.path === "/back39" ? "/back39" : b.path === "/checkout" ? "/checkout" : "/start39";
  const existing = await getCheckoutLead(token);
  if (existing?.done && existing.contractId) return json({ error: "Dieser Abschluss ist schon abgeschlossen", done: true, contractId: existing.contractId }, 409);
  const l: CheckoutLead = { ...(existing || { token, campaign: offerName, path, createdAt: new Date().toISOString(), done: false }), firstName, lastName, email, phone, months: b.months === 12 ? 12 : b.months === 1 ? 1 : existing?.months, utm: str(b.utm, 200) || existing?.utm, express: true, wallet: str(b.wallet, 20) || existing?.wallet };
  /* Interessent in Magicline, damit der Vertrag am selben Kunden hängt */
  if (!l.leadUuid) {
    try {
      const lead = await createLeadServer({ firstname: firstName, lastname: lastName, email, phone, notes: `${offerName} Website Express (${l.wallet || "Wallet"}), Quelle: ${l.utm || "unbekannt"}` });
      if (lead.uuid) { l.leadUuid = lead.uuid; l.customerNumber = lead.customerNumber; }
      console.log(`stripe-express lead ${token}: Magicline ${lead.status} ${lead.customerNumber || "-"}`);
    } catch (e) { console.log("stripe-express lead error", String(e)); }
  }
  l.card = { rateBundleTermId: termId, startDate, dob, street, houseNumber, zip, city, signatureSvgBase64: sig, price: Number(b.price) || 39, offerName, sourceUrl: str(b.sourceUrl, 300), fbp: b.fbp ? str(b.fbp, 100) : undefined, fbc: b.fbc ? str(b.fbc, 200) : undefined, savedAt: new Date().toISOString() };
  /* Bestehendes, noch unbezahltes Abo weiterverwenden (zweiter Versuch), sonst Kunde + Abo anlegen */
  let subId = l.stripe?.subscriptionId || "", customerId = l.stripe?.customerId || "", clientSecret = "";
  if (subId) {
    const s = await stripe("GET", `/subscriptions/${subId}`, { "expand[]": "latest_invoice.payment_intent" });
    if (s.ok && s.data.status === "incomplete" && s.data.latest_invoice?.payment_intent?.client_secret) clientSecret = s.data.latest_invoice.payment_intent.client_secret; else subId = "";
  }
  if (!clientSecret) {
    if (!customerId) {
      const c = await stripe("POST", "/customers", { email, name: `${firstName} ${lastName}`, phone, address: { line1: `${street} ${houseNumber}`.trim(), postal_code: zip, city, country }, metadata: { token, magicline: l.customerNumber || "", offer: offerName } });
      if (!c.ok) { console.log("stripe-express customer", c.status, JSON.stringify(c.data).slice(0, 300)); return json({ error: c.data?.error?.message || "Stripe-Kunde konnte nicht angelegt werden" }, 502); }
      customerId = c.data.id;
    }
    const s = await stripe("POST", "/subscriptions", { customer: customerId, items: [{ price }], payment_behavior: "default_incomplete", payment_settings: { save_default_payment_method: "on_subscription" }, "expand[]": "latest_invoice.payment_intent", description: `${offerName} Mitgliedschaft SKILL CGN`, metadata: { token, offer: offerName, magicline: l.customerNumber || "" } });
    if (!s.ok || !s.data.latest_invoice?.payment_intent?.client_secret) { console.log("stripe-express subscription", s.status, JSON.stringify(s.data).slice(0, 300)); return json({ error: s.data?.error?.message || "Abo konnte nicht angelegt werden" }, 502); }
    subId = s.data.id; clientSecret = s.data.latest_invoice.payment_intent.client_secret;
  }
  l.stripe = { ...(l.stripe || {}), subscriptionId: subId, customerId };
  await saveCheckoutLead(l);
  return json({ ok: true, clientSecret, subscriptionId: subId, customerNumber: l.customerNumber || "" });
}

async function complete(token: string, req: Request) {
  const l = await getCheckoutLead(token);
  if (!l) return json({ error: "Unbekanntes Token" }, 404);
  if (l.done && l.contractId) return json({ done: true, contractId: l.contractId, customerNumber: l.customerNumber || "" });
  const subId = l.stripe?.subscriptionId; if (!subId) return json({ error: "Kein Abo zu diesem Abschluss" }, 400);
  const s = await stripe("GET", `/subscriptions/${subId}`, { "expand[]": "latest_invoice.payment_intent" });
  if (!s.ok) return json({ error: s.data?.error?.message || "Stripe nicht erreichbar" }, 502);
  const pi = s.data.latest_invoice?.payment_intent;
  const paid = ["active", "trialing"].includes(s.data.status) || pi?.status === "succeeded" || s.data.latest_invoice?.paid === true;
  if (!paid) return json({ done: false, paid: false, status: s.data.status, payment: pi?.status || "" });
  const r = await completeMembership(l, { subscriptionId: subId, customerId: typeof s.data.customer === "string" ? s.data.customer : undefined, amount: pi?.amount != null ? pi.amount / 100 : undefined },
    { ip: req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined, userAgent: req.headers.get("user-agent") || undefined });
  return json({ done: r.ok, paid: true, contractId: r.contractId || "", customerNumber: r.customerNumber || "", error: r.ok ? "" : r.note || "" });
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!stripeConfigured()) return json({ error: "Express-Abschluss nicht konfiguriert" }, 503);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage" }, 400); }
  const token = String(b.token || ""); if (!TOKEN.test(token)) return json({ error: "Ungültiges Token" }, 400);
  if (b.action === "subscribe") return subscribe(b, token, req);
  if (b.action === "complete") return complete(token, req);
  return json({ error: "Unbekannte Aktion" }, 400);
};
export const config: Config = { path: "/api/stripe/express" };
