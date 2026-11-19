/* Mitgliedschaft per Stripe abschließen: Magicline-Vertrag für den Interessenten (Zahlart BANK_TRANSFER, Stripe zieht das Abo ein),
   Purchase serverseitig an Meta. Genutzt vom Stripe-Webhook (Payment Link, invoice.paid) und vom Express-Abschluss (/api/stripe/express). */
import { type CheckoutLead, saveCheckoutLead } from "./store";
import { createContractServer } from "./connect";
import { sendPurchase, capiConfigured } from "./meta-capi";
import { sendContractMails, sendContractFailedMails } from "./notify";
import { deliverWelcome } from "./welcome";

export interface StripeRef { sessionId?: string; subscriptionId?: string; customerId?: string; amount?: number }
export async function completeMembership(l: CheckoutLead, ref: StripeRef, client: { ip?: string; userAgent?: string } = {}): Promise<{ ok: boolean; note?: string; contractId?: string; customerNumber?: string }> {
  if (l.done && l.contractId) return { ok: true, note: "schon angelegt", contractId: l.contractId, customerNumber: l.customerNumber };
  l.stripe = { ...(l.stripe || {}), ...ref, paidAt: l.stripe?.paidAt || new Date().toISOString() };
  if (!l.card) { l.contractError = "Vertragsdaten fehlen (Kartendaten nicht gespeichert)"; await saveCheckoutLead(l); return { ok: false, note: l.contractError }; }
  const c = l.card; const sub = ref.subscriptionId || l.stripe.subscriptionId || ref.sessionId || "";
  const r = await createContractServer({ rateBundleTermId: c.rateBundleTermId, startDate: c.startDate, signatureSvgBase64: c.signatureSvgBase64 || "", identityToken: l.leadUuid || undefined,
    notes: `Onlineabschluss ${c.offerName} ${l.express ? "Express (Wallet)" : "Landingpage"}, Zahlung per Stripe-Abo ${sub} (Karte/Wallet), Quelle: ${l.utm || "unbekannt"}`,
    firstname: l.firstName, lastname: l.lastName, email: l.email, phone: l.phone, dob: c.dob, street: c.street, houseNumber: c.houseNumber, zip: c.zip, city: c.city, paymentChoice: "BANK_TRANSFER" });
  console.log(`membership ${l.token}: Magicline ${r.status} contract=${r.contractId || "-"} ${r.ok ? "" : r.raw.slice(0, 200)}`);
  if (!r.ok) {
    l.contractError = `Magicline ${r.status}: ${r.raw.slice(0, 200)}`;
    /* Zahlung ist da, Vertrag nicht: Team sofort informieren (einmal), Kunde bekommt einen Zwischenbescheid */
    if (!(l as any).failAlertAt) { (l as any).failAlertAt = new Date().toISOString(); await sendContractFailedMails({ firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone, customerNumber: l.customerNumber, offerName: c.offerName, price: c.price || 39, startDate: c.startDate, payment: l.express ? "express" : "card", months: l.months, token: l.token, error: l.contractError, stripe: l.stripe }).catch(e => console.log("fail mail error", String(e))); }
    await saveCheckoutLead(l); return { ok: false, note: l.contractError };
  }
  l.done = true; l.contractId = r.contractId; l.customerNumber = r.customerNumber || l.customerNumber; l.contractError = undefined;
  delete (l.card as any).signatureSvgBase64;
  /* Purchase serverseitig, event_id = Vertragsnummer (der Browser feuert auf /danke mit derselben ID) */
  if (capiConfigured() && !l.capi?.sent) {
    try {
      const res = await sendPurchase({ eventId: r.contractId, value: c.price || 39, contentName: c.offerName, sourceUrl: c.sourceUrl || "https://skill-studios.com" + l.path, email: l.email, phone: l.phone, firstName: l.firstName, lastName: l.lastName, zip: c.zip, city: c.city, fbp: c.fbp, fbc: c.fbc, clientIp: client.ip, userAgent: client.userAgent || "stripe-server" });
      l.capi = { at: new Date().toISOString(), sent: res.sent, status: res.status, note: res.skipped || res.body?.slice(0, 120) };
    } catch (e) { l.capi = { at: new Date().toISOString(), sent: false, note: String(e).slice(0, 120) }; }
  }
  await saveCheckoutLead(l);
  const mails = await sendContractMails({ firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone, customerNumber: l.customerNumber, contractId: r.contractId, offerName: c.offerName, price: c.price || 39, startDate: c.startDate, payment: l.express ? "express" : "card", months: l.months, token: l.token }).catch(e => { console.log("contract mail error", String(e)); return { staff: false, customer: false }; });
  /* Ein Paket (Issue #2): Willkommensmail mit Vertrag und SEPA-Mandat, Rest über checkout-reminder */
  l.welcome = { pendingSince: new Date().toISOString(), ...(Number(r.customerId) > 0 ? { customerId: Number(r.customerId) } : {}), input: { offerName: c.offerName, price: c.price || 39, startDate: c.startDate } };
  const welcome = await deliverWelcome(l, { firstName: l.firstName, email: l.email, contractId: r.contractId, offerName: c.offerName, price: c.price || 39, startDate: c.startDate, months: l.months }, { budgetMs: 4000 })
    .catch(e => { console.log("welcome error", String(e)); return "pending" as const; });
  await saveCheckoutLead(l);
  console.log(`membership ${l.token}: mail staff=${mails.staff} willkommen=${welcome}`);
  return { ok: true, contractId: r.contractId, customerNumber: l.customerNumber };
}
