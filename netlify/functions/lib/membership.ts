/* Mitgliedschaft per Stripe abschließen: Magicline-Vertrag für den Interessenten (Zahlart BANK_TRANSFER, Stripe zieht das Abo ein),
   Purchase serverseitig an Meta. Genutzt vom Stripe-Webhook (Payment Link, invoice.paid) und vom Express-Abschluss (/api/stripe/express). */
import { type CheckoutLead, saveCheckoutLead } from "./store";
import { createContractServer } from "./connect";
import { sendPurchase, capiConfigured } from "./meta-capi";

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
  if (!r.ok) { l.contractError = `Magicline ${r.status}: ${r.raw.slice(0, 200)}`; await saveCheckoutLead(l); return { ok: false, note: l.contractError }; }
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
  return { ok: true, contractId: r.contractId, customerNumber: l.customerNumber };
}
