/* Checkout-Abbrecher für /start39, /back39 und /blackweek.
   POST { token, campaign, path, firstName, lastName, email, phone, months? }  → Lead nach Schritt 1 sichern (10-Minuten-Uhr läuft ab hier)
   POST { token, done: true }                                                 → Vertrag ist da, keine Mail
   GET  ?token=…                                                              → Schritt-1-Daten für die Wiederherstellung aus der Mail */
import type { Config } from "@netlify/functions";
import { json, normEmail, validEmail } from "./lib/util";
import { getCheckoutLead, saveCheckoutLead, type CheckoutLead } from "./lib/store";
import { sendPurchase, capiConfigured } from "./lib/meta-capi";
import { sendContractMails } from "./lib/notify";

const TOKEN = /^[a-z0-9]{16,48}$/;
/* Abschlussseite → Kampagnenname (Lead, Vertragsmail, Meta CAPI) */
const CAMPAIGNS = { "/start39": "START 39", "/back39": "BACK 39", "/blackweek": "BLACK WEEK 29" } as const;

export default async (req: Request) => {
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!TOKEN.test(token)) return json({ error: "Ungültiger Link" }, 400);
    const l = await getCheckoutLead(token);
    /* Status für /danke nach Stripe-Zahlung: nur Vertragsnummer und Kunde, keine Kontaktdaten */
    if (new URL(req.url).searchParams.get("status") === "1") {
      if (!l) return json({ error: "Unbekannt" }, 404);
      return json({ done: !!l.done, contractId: l.contractId || "", customerNumber: l.customerNumber || "", paid: !!l.stripe, error: l.contractError || "" });
    }
    if (!l || l.done) return json({ error: "Link abgelaufen" }, 404);
    return json({ campaign: l.campaign, firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone, months: l.months ?? null, leadUuid: l.leadUuid || "", customerNumber: l.customerNumber || "" });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage" }, 400); }
  const token = String(b.token || "");
  if (!TOKEN.test(token)) return json({ error: "Ungültiges Token" }, 400);
  if (b.done === true) {
    const l = await getCheckoutLead(token);
    if (!l) return json({ ok: true });
    const already = l.done && l.capi?.sent;
    const firstDone = !l.done && !!b.contractId;
    l.done = true; if (b.contractId) l.contractId = String(b.contractId).slice(0, 40);
    /* SEPA-Weg (Vertrag im Browser angelegt): "Neuer Vertrag" ans Team und Willkommensmail, nur beim ersten Abschluss-Aufruf */
    if (firstDone && l.contractId) {
      const mails = await sendContractMails({ firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone, customerNumber: String(b.customerNumber || l.customerNumber || "").slice(0, 20) || undefined, contractId: l.contractId, offerName: l.campaign, price: Number(b.value) > 0 ? Number(b.value) : 39, startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || "")) ? String(b.startDate) : undefined, payment: "sepa", months: l.months, token: l.token }).catch(e => { console.log("contract mail error", String(e)); return { staff: false, customer: false }; });
      (l as any).mails = { at: new Date().toISOString(), ...mails };
      console.log(`checkout-lead done ${l.token} Vertrag ${l.contractId}: mail staff=${mails.staff} customer=${mails.customer}`);
    }
    /* Meta Conversions API: nur mit bestätigter Vertragsnummer, nur einmal, nur mit Cookie-Zustimmung
       (META_CAPI_ALWAYS=true sendet auch ohne, nachdem die Datenschutzerklärung den Hinweis enthält). */
    const consentOk = b.consent === "accepted" || process.env.META_CAPI_ALWAYS === "true";
    if (l.contractId && !already && capiConfigured() && consentOk) {
      try {
        const res = await sendPurchase({ eventId: l.contractId, value: Number(b.value) > 0 ? Number(b.value) : 39, contentName: l.campaign, sourceUrl: String(b.sourceUrl || "https://skill-studios.com" + l.path).slice(0, 300),
          email: l.email, phone: l.phone, firstName: l.firstName, lastName: l.lastName, zip: b.zip ? String(b.zip) : undefined, city: b.city ? String(b.city) : undefined,
          clientIp: req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined, userAgent: req.headers.get("user-agent") || undefined,
          fbp: b.fbp ? String(b.fbp).slice(0, 100) : undefined, fbc: b.fbc ? String(b.fbc).slice(0, 200) : undefined });
        l.capi = { at: new Date().toISOString(), sent: res.sent, status: res.status, note: res.skipped || res.body?.slice(0, 120) };
        console.log(`meta-capi Purchase ${l.contractId}: ${res.sent ? "gesendet" : "nicht gesendet"} ${res.status || ""} ${res.skipped || res.body || ""}`);
      } catch (e) { l.capi = { at: new Date().toISOString(), sent: false, note: String(e).slice(0, 120) }; console.log("meta-capi Fehler", String(e)); }
    } else if (l.contractId && !already) {
      l.capi = { at: new Date().toISOString(), sent: false, note: !capiConfigured() ? "META_CAPI_TOKEN fehlt" : !consentOk ? "keine Cookie-Zustimmung" : "übersprungen" };
    }
    await saveCheckoutLead(l);
    return json({ ok: true, capi: l.capi?.sent ?? false });
  }
  /* Kartenweg: Vertragsdaten vor der Weiterleitung zu Stripe sichern, der Webhook legt den Magicline-Vertrag nach der Zahlung an */
  if (b.card && typeof b.card === "object") {
    const l = await getCheckoutLead(token);
    if (!l) return json({ error: "Unbekanntes Token" }, 404);
    const c = b.card;
    if (!c.rateBundleTermId || !c.startDate || !c.dob || !c.signatureSvgBase64) return json({ error: "Vertragsdaten unvollständig" }, 400);
    l.card = { rateBundleTermId: Number(c.rateBundleTermId), startDate: String(c.startDate).slice(0, 10), dob: String(c.dob).slice(0, 10), street: String(c.street || "").slice(0, 120), houseNumber: String(c.houseNumber || "").slice(0, 20), zip: String(c.zip || "").slice(0, 10), city: String(c.city || "").slice(0, 80),
      signatureSvgBase64: String(c.signatureSvgBase64).slice(0, 200000), price: Number(c.price) || 39, offerName: String(c.offerName || l.campaign).slice(0, 40), sourceUrl: String(c.sourceUrl || "").slice(0, 300), fbp: c.fbp ? String(c.fbp).slice(0, 100) : undefined, fbc: c.fbc ? String(c.fbc).slice(0, 200) : undefined, savedAt: new Date().toISOString() };
    await saveCheckoutLead(l);
    return json({ ok: true });
  }
  /* Abbruch in Schritt 2 oder 3 (pagehide): nur Merker, kein neuer Lead */
  if (b.abandonedStep) {
    const l = await getCheckoutLead(token);
    if (l && !l.done) { l.abandonedStep = Number(b.abandonedStep) || undefined; await saveCheckoutLead(l); }
    return json({ ok: true });
  }
  const email = normEmail(String(b.email || ""));
  const firstName = String(b.firstName || "").trim().slice(0, 80), lastName = String(b.lastName || "").trim().slice(0, 80), phone = String(b.phone || "").trim().slice(0, 40);
  const path = (Object.keys(CAMPAIGNS).includes(b.path) ? b.path : "/start39") as keyof typeof CAMPAIGNS;
  const campaign = CAMPAIGNS[path];
  if (!firstName || !validEmail(email)) return json({ error: "Bitte Vorname und E-Mail angeben" }, 400);
  const existing = await getCheckoutLead(token);
  const lead: CheckoutLead = { token, campaign, path, firstName, lastName, email, phone, months: b.months === 12 ? 12 : b.months === 1 ? 1 : undefined, createdAt: existing?.createdAt || new Date().toISOString(), done: false, mailedAt: existing?.mailedAt,
    leadUuid: /^[0-9a-f-]{36}$/i.test(String(b.leadUuid || "")) ? String(b.leadUuid) : existing?.leadUuid, customerNumber: String(b.customerNumber || existing?.customerNumber || "").slice(0, 20), utm: String(b.utm || existing?.utm || "").slice(0, 200) };
  await saveCheckoutLead(lead);
  return json({ ok: true });
};
export const config: Config = { path: "/api/checkout-lead" };
