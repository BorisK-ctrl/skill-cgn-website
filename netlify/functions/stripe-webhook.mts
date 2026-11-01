/* POST /api/stripe/webhook → checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted.
   1. Shop (metadata.purchase_type = shop): Ticket-Guthaben je E-Mail anlegen oder aufstocken.
   2. Membership per Karte (mode = subscription, client_reference_id = Checkout-Token): Magicline-Vertrag für den Interessenten
      anlegen (Zahlart BANK_TRANSFER, Stripe zieht das Abo ein), Purchase serverseitig an Meta.
   3. Black Month (metadata.campaign blackmonth_2026 oder Payment Link plink_1UX2n6HMQZbugHGZViuXdvsC): Interessent, Mail 1, Info an Boris, Meta CAPI.
   Signaturprüfung mit STRIPE_WEBHOOK_SECRET (Netlify-Umgebungsvariable). Lokaler Test: scripts/test-blackmonth-webhook.mjs. */
import type { Config } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "node:crypto";
import { json, normEmail, addDays, berlinDate } from "./lib/util";
import { getTicket, saveTicket, seenEvent, markEvent } from "./lib/store";
import type { TicketAccount } from "./lib/types";
import { getCheckoutLead, saveCheckoutLead, saveAlert, getBlackMonth, saveBlackMonth, findBlackMonthByContact } from "./lib/store";
import type { BlackMonthRecord } from "./lib/store";
import { sendStaffAlert, sendShopMails, sendBlackMonthWelcome, sendBlackMonthStaff } from "./lib/notify";
import { createLeadServer } from "./lib/connect";
import { sendPurchase, capiConfigured } from "./lib/meta-capi";
import { SITE } from "./lib/util";
import { completeMembership } from "./lib/membership";
import { stripe, stripeConfigured } from "./lib/stripe";

/* Kartenweg über Payment Link: Vertrag nach bezahlter Checkout-Sitzung anlegen. */
async function handleMembership(s: any) {
  const token = String(s.client_reference_id || "");
  const l = /^[a-z0-9]{16,48}$/.test(token) ? await getCheckoutLead(token) : null;
  if (!l) return { ok: false, note: "kein Checkout-Token" };
  const sub = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
  return completeMembership(l, { sessionId: s.id, subscriptionId: sub || undefined, customerId: typeof s.customer === "string" ? s.customer : undefined, amount: s.amount_total != null ? s.amount_total / 100 : undefined }, { userAgent: "stripe-webhook" });
}
/* Express-Abschluss: invoice.paid als Sicherheitsnetz, falls der Browser nach der Zahlung nicht mehr "complete" ruft. Token steht in den Abo-Metadaten. */
async function handleInvoicePaid(inv: any) {
  const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id; if (!subId) return { ok: false, note: "kein Abo" };
  let token = String(inv.subscription_details?.metadata?.token || "");
  if (!token && stripeConfigured()) { const s = await stripe("GET", `/subscriptions/${subId}`); token = String(s.data?.metadata?.token || ""); }
  const l = /^[a-z0-9]{16,48}$/.test(token) ? await getCheckoutLead(token) : null;
  if (!l) return { ok: false, note: "kein Checkout-Token am Abo" };
  return completeMembership(l, { subscriptionId: subId, customerId: typeof inv.customer === "string" ? inv.customer : undefined, amount: inv.amount_paid != null ? inv.amount_paid / 100 : undefined }, { userAgent: "stripe-webhook" });
}

/* Token zum Abo (Metadaten), daraus der Checkout-Datensatz */
async function leadForSubscription(subId: string, metaToken?: string) {
  let token = String(metaToken || "");
  if (!token && stripeConfigured()) { const s = await stripe("GET", `/subscriptions/${subId}`); token = String(s.data?.metadata?.token || ""); }
  return /^[a-z0-9]{16,48}$/.test(token) ? await getCheckoutLead(token) : null;
}
/* Zahlung fehlgeschlagen (invoice.payment_failed): ab dem zweiten Versuch Hinweis ans Team. Magicline-Notiz und Sperre gehen über die Connect API nicht,
   das bleibt Handarbeit in Magicline (Zahlungsstopp am Vertrag), bis ein Open-API-Schlüssel da ist. */
async function handlePaymentFailed(inv: any) {
  const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id; if (!subId) return { ok: false, note: "kein Abo" };
  const l = await leadForSubscription(subId, inv.subscription_details?.metadata?.token);
  const attempts = Number(inv.attempt_count || 1); const amount = inv.amount_due != null ? inv.amount_due / 100 : undefined;
  if (l) { l.payment = { status: "failed", at: new Date().toISOString(), attempts, amount, note: inv.last_finalization_error?.message || inv.last_payment_error?.message || "" }; await saveCheckoutLead(l); }
  if (attempts < 2) return { ok: true, note: `Versuch ${attempts}, noch kein Hinweis`, token: l?.token };
  const name = l ? `${l.firstName} ${l.lastName}` : String(inv.customer_name || ""); const email = l?.email || String(inv.customer_email || "");
  const mailed = await sendStaffAlert(`Stripe: Zahlung fehlgeschlagen, ${name}, ${amount ?? "?"} €`, [`Mitglied: <strong>${name}</strong> (${email})`, `Magicline: Kunde ${l?.customerNumber || "?"}, Vertrag ${l?.contractId || "?"}`, `Stripe-Abo ${subId}, Versuch ${attempts}, Betrag ${amount ?? "?"} €`, `Bitte in Magicline eine Notiz am Kunden anlegen und den Vertrag auf Zahlungsstopp setzen, in Stripe das Abo prüfen.`]).catch(() => false);
  await saveAlert({ at: new Date().toISOString(), kind: "payment_failed", token: l?.token, customerNumber: l?.customerNumber, contractId: l?.contractId, name, email, amount, attempts, subscriptionId: subId, mailed, magicline: "manuell: Notiz + Zahlungsstopp" });
  console.log(`stripe-webhook payment_failed ${subId} ${name} Versuch ${attempts} mail=${mailed}`);
  return { ok: true, alerted: true, mailed, token: l?.token };
}
/* Abo beendet (customer.subscription.deleted): Hinweis ans Team, der Magicline-Vertrag muss von Hand gekündigt oder geprüft werden. */
async function handleSubscriptionDeleted(sub: any) {
  const l = await leadForSubscription(sub.id, sub.metadata?.token);
  if (l) { l.payment = { status: "cancelled", at: new Date().toISOString(), note: sub.cancellation_details?.reason || "" }; l.stripe = { ...(l.stripe || {}), subscriptionId: sub.id }; await saveCheckoutLead(l); }
  const name = l ? `${l.firstName} ${l.lastName}` : ""; const email = l?.email || "";
  const mailed = await sendStaffAlert(`Stripe: Abo beendet, ${name || sub.id}`, [`Mitglied: <strong>${name || "unbekannt"}</strong> (${email})`, `Magicline: Kunde ${l?.customerNumber || "?"}, Vertrag ${l?.contractId || "?"}`, `Stripe-Abo ${sub.id} ist beendet (${sub.cancellation_details?.reason || "ohne Grund"}).`, `Bitte in Magicline prüfen, ob der Vertrag gekündigt ist, sonst kündigen oder das Mitglied ansprechen.`]).catch(() => false);
  await saveAlert({ at: new Date().toISOString(), kind: "subscription_deleted", token: l?.token, customerNumber: l?.customerNumber, contractId: l?.contractId, name, email, subscriptionId: sub.id, mailed, magicline: "manuell: Vertrag prüfen/kündigen" });
  console.log(`stripe-webhook subscription_deleted ${sub.id} ${name} mail=${mailed}`);
  return { ok: true, mailed, token: l?.token };
}

const PRODUCTS: Record<string, { name: string; credits: number; pt: number; validDays: number; link: string; amount: number }> = {
  "trial-pass": { name: "Trial Pass", credits: 3, pt: 0, validDays: 21, link: "plink_14A00j5bZ4wn6vKc1x5EY00", amount: 2900 },
  "drop-in": { name: "Drop In", credits: 1, pt: 0, validDays: 30, link: "plink_8x27sLdIv0g7cU86Hd5EY04", amount: 2000 },
  "5-pass": { name: "5 Pass", credits: 5, pt: 0, validDays: 42, link: "plink_4gM14ncEr4wn2fuc1x5EY01", amount: 9000 },
  "10-pass": { name: "10 Pass", credits: 10, pt: 0, validDays: 84, link: "plink_8x28wP0VJ9QH7zO9Tp5EY05", amount: 17000 },
  "pt-single": { name: "Personal Training Einzelstunde", credits: 0, pt: 1, validDays: 60, link: "plink_3cIcN50VJd2TcU8d5B5EY06", amount: 12000 },
  "pt-5er": { name: "Personal Training 5er-Karte", credits: 0, pt: 5, validDays: 120, link: "plink_bJe8wPdIvgf51bq3v15EY02", amount: 50000 },
  "pt-10er": { name: "Personal Training 10er-Karte", credits: 0, pt: 10, validDays: 240, link: "plink_4gM9AT9sffb107m9Tp5EY03", amount: 90000 },
  "black-month": { name: "Black Month: 6 Monate Gym", credits: 0, pt: 0, validDays: 182, link: "", amount: 14900 },
};
/* Aktion Black Month (2. bis 30.11.2026, 149 € einmalig). Erkennung: metadata.campaign "blackmonth_2026" oder der Payment Link, zur Sicherheit Produkt/Betrag.
   Je Kauf: Interessent in Magicline (Dublette über E-Mail oder Telefon wird nicht neu angelegt), Mail 1 an den Käufer, Info an Boris, Purchase an Meta (CAPI, event_id = Sitzung). */
const BLACK_MONTH = { campaign: "blackmonth_2026", paymentLink: "plink_1UX2n6HMQZbugHGZViuXdvsC", amount: 14900, name: "Black Month" };
export const isBlackMonth = (s: any) => s?.mode !== "subscription" && (s?.metadata?.campaign === BLACK_MONTH.campaign || s?.payment_link === BLACK_MONTH.paymentLink || productFor(s) === "black-month");
async function handleBlackMonth(s: any, eventId: string) {
  const email = normEmail(s.customer_details?.email || s.customer_email || "");
  const name = String(s.customer_details?.name || "").trim(); const [firstName, ...rest] = name.split(/\s+/); const lastName = rest.join(" ") || firstName || "Black Month";
  const phone = String(s.customer_details?.phone || ""); const amount = (s.amount_total ?? BLACK_MONTH.amount) / 100;
  const existing = await getBlackMonth(s.id);
  if (existing) { await markEvent(eventId); return json({ received: true, blackMonth: true, duplicateSession: true }); }
  const rec: BlackMonthRecord = { sessionId: s.id, at: new Date().toISOString(), name, email, phone, amount, customerId: typeof s.customer === "string" ? s.customer : null, ref: String(s.client_reference_id || "").slice(0, 200) || undefined, mails: {}, appointmentAt: null };
  /* Magicline-Interessent, Notiz mit Sitzung und Datum. Gleiche E-Mail oder Telefon aus einem früheren Kauf: kein zweiter Interessent. */
  const dup = await findBlackMonthByContact(email, phone);
  if (dup) rec.duplicateOf = dup;
  else {
    const date = berlinDate(new Date()).split("-").reverse().join(".");
    try { const lead = await createLeadServer({ firstname: firstName || "Black", lastname: lastName, email, phone, notes: `Black Month 149 € bezahlt, Stripe ${s.id}, ${date}` }); rec.magicline = lead.customerNumber || null; rec.magiclineStatus = lead.status; }
    catch (e) { rec.magiclineStatus = 0; console.log("black-month lead error", String(e)); }
  }
  await saveBlackMonth(rec);
  /* Mail 1 an den Käufer, Info an Boris */
  if (email) rec.mails.welcome = (await sendBlackMonthWelcome(rec).catch(e => { console.log("black-month welcome error", String(e)); return false; })) ? new Date().toISOString() : "failed";
  rec.mails.staff = (await sendBlackMonthStaff({ ...rec, duplicate: !!rec.duplicateOf, leadStatus: rec.magiclineStatus }).catch(e => { console.log("black-month staff error", String(e)); return false; })) ? new Date().toISOString() : "failed";
  /* Purchase serverseitig an Meta, event_id = Stripe-Sitzung, dedupliziert mit dem Browser-Event auf /blackmonth/danke */
  if (capiConfigured() && email) {
    try { const r = await sendPurchase({ eventId: s.id, value: amount, contentName: BLACK_MONTH.name, sourceUrl: `${SITE}/blackmonth/danke`, email, phone, firstName, lastName: rest.join(" "), userAgent: "stripe-server" }); rec.capi = { at: new Date().toISOString(), sent: r.sent, note: r.skipped || r.body?.slice(0, 120) }; }
    catch (e) { rec.capi = { at: new Date().toISOString(), sent: false, note: String(e).slice(0, 120) }; }
  }
  await saveBlackMonth(rec); await markEvent(eventId);
  console.log(`stripe-webhook black-month ${s.id} ${email} magicline=${rec.duplicateOf ? "dublette" : (rec.magiclineStatus + "/" + (rec.magicline || "-"))} welcome=${rec.mails.welcome} staff=${rec.mails.staff} capi=${rec.capi?.sent ?? "aus"}`);
  return json({ received: true, blackMonth: true, sessionId: s.id, magicline: rec.magicline || null, duplicateOf: rec.duplicateOf || null, mails: rec.mails, capi: rec.capi?.sent ?? null });
}
/* Produkt zur Checkout-Sitzung: Metadaten des Payment Links, sonst Betrag (die Beträge sind eindeutig). */
function productFor(s: any): string {
  const md = s.metadata || {}; if (md.product_id && PRODUCTS[md.product_id]) return md.product_id;
  const total = Number(s.amount_total); const byAmount = Object.entries(PRODUCTS).find(([, p]) => p.amount === total);
  return byAmount ? byAmount[0] : "";
}
function verify(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=") as [string, string]));
  const ts = parts.t; const sig = parts.v1; if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) return json({ error: "Webhook nicht konfiguriert" }, 503);
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature") || "", secret)) return json({ error: "Signatur ungültig" }, 400);
  const event = JSON.parse(payload);
  const HANDLED = ["checkout.session.completed", "invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"];
  if (!HANDLED.includes(event.type)) return json({ received: true, ignored: event.type });
  if (await seenEvent(event.id)) return json({ received: true, duplicate: true });
  if (event.type === "invoice.payment_failed") { const m = await handlePaymentFailed(event.data.object); await markEvent(event.id); return json({ received: true, paymentFailed: m }); }
  if (event.type === "customer.subscription.deleted") { const m = await handleSubscriptionDeleted(event.data.object); await markEvent(event.id); return json({ received: true, subscriptionDeleted: m }); }
  if (event.type === "invoice.paid") {
    const inv = event.data.object;
    /* Nur die erste Rechnung eines Abos legt den Vertrag an; Folgerechnungen alle vier Wochen laufen ins Leere (Vertrag existiert). */
    const m = await handleInvoicePaid(inv); await markEvent(event.id);
    return json({ received: true, membership: m });
  }
  const s = event.data.object; const md = s.metadata || {};
  /* Membership per Karte: Abo-Sitzung mit unserem Checkout-Token */
  if (s.mode === "subscription" && s.client_reference_id && s.payment_status === "paid") {
    const m = await handleMembership(s); await markEvent(event.id);
    return json({ received: true, membership: m });
  }
  /* Black Month: nur bezahlte Sitzungen */
  if (isBlackMonth(s)) {
    if (s.payment_status !== "paid") { await markEvent(event.id); console.log(`stripe-webhook black-month unbezahlt ${s.id}: ${s.payment_status}`); return json({ received: true, ignored: "black month not paid" }); }
    return handleBlackMonth(s, event.id);
  }
  const productId = productFor(s); const product = PRODUCTS[productId];
  if (s.mode === "subscription" || !product || s.payment_status !== "paid") { await markEvent(event.id); console.log(`stripe-webhook ignoriert ${s.id}: mode=${s.mode} product=${productId || "-"} status=${s.payment_status}`); return json({ received: true, ignored: "not a paid shop purchase" }); }
  /* Käuferdaten aus der Stripe-Sitzung (customer_details), nicht aus Formularfeldern */
  const email = normEmail(s.customer_details?.email || s.customer_email || "");
  if (!email) { await markEvent(event.id); await sendStaffAlert(`Shop-Verkauf ohne E-Mail: ${product.name}`, [`Stripe-Sitzung ${s.id}, Betrag ${(s.amount_total || 0) / 100} €`, `Bitte in Stripe nachsehen, wer gezahlt hat.`]).catch(() => false); return json({ received: true, ignored: "no email" }); }
  const name = String(s.customer_details?.name || "").trim(); const [firstName, ...rest] = name.split(/\s+/);
  const today = berlinDate(new Date()); const validUntil = addDays(today, product.validDays);
  const t: TicketAccount = (await getTicket(email)) || { email, firstName: firstName || "", lastName: rest.join(" "), phone: "", credits: 0, ptCredits: 0, validUntil: null, purchases: [], updatedAt: "" };
  t.firstName ||= firstName || ""; t.lastName ||= rest.join(" "); t.phone = s.customer_details?.phone || t.phone; t.stripeCustomerId = s.customer || t.stripeCustomerId;
  t.credits += product.credits; t.ptCredits += product.pt;
  t.validUntil = !t.validUntil || t.validUntil < validUntil ? validUntil : t.validUntil;
  t.purchases.push({ product: md.product_id, sessionId: s.id, credits: product.credits + product.pt, at: new Date().toISOString() });
  t.updatedAt = new Date().toISOString();
  await saveTicket(t); await markEvent(event.id);
  const mails = await sendShopMails({ productId, productName: product.name, amount: (s.amount_total ?? product.amount) / 100, name, email, phone: String(s.customer_details?.phone || ""), sessionId: s.id, credits: t.credits, ptCredits: t.ptCredits, validUntil: t.validUntil }).catch(e => { console.log("shop mail error", String(e)); return { staff: false, customer: false }; });
  console.log(`stripe-webhook shop ${productId} ${email} mail staff=${mails.staff} customer=${mails.customer}`);
  return json({ received: true, email, credits: t.credits, ptCredits: t.ptCredits, validUntil: t.validUntil, mails });
};
export const config: Config = { path: "/api/stripe/webhook" };
