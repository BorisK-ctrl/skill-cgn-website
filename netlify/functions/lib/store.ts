/* Ablage in Netlify Blobs. Lokal ohne Blobs-Kontext: In-Memory-Fallback (nur für den Dev-Server). */
import { getStore } from "@netlify/blobs";
import type { Booking, TicketAccount } from "./types";

const mem: Record<string, Map<string, unknown>> = {};
function store(name: string) {
  try { return getStore({ name, consistency: "strong" }); } catch { return null; }
}
async function getJSON<T>(name: string, key: string): Promise<T | null> {
  const s = store(name);
  if (!s) return ((mem[name] ||= new Map()).get(key) as T) ?? null;
  return ((await s.get(key, { type: "json" })) as T) ?? null;
}
async function setJSON(name: string, key: string, value: unknown) {
  const s = store(name);
  if (!s) { (mem[name] ||= new Map()).set(key, value); return; }
  await s.setJSON(key, value);
}
async function listKeys(name: string, prefix: string): Promise<string[]> {
  const s = store(name);
  if (!s) return [...(mem[name] ||= new Map()).keys()].filter(k => k.startsWith(prefix));
  const { blobs } = await s.list({ prefix });
  return blobs.map(b => b.key);
}

/* Buchungen: Schlüssel "<slotId>/<bookingId>" damit Zählung je Slot per Prefix geht. */
export const bookingKey = (slotId: string, id: string) => `${encodeURIComponent(slotId)}/${id}`;
export async function saveBooking(b: Booking) { await setJSON("bookings", bookingKey(b.slotId, b.id), b); await setJSON("booking-index", b.id, { slotId: b.slotId }); }
export async function getBooking(id: string): Promise<Booking | null> {
  const idx = await getJSON<{ slotId: string }>("booking-index", id); if (!idx) return null;
  return getJSON<Booking>("bookings", bookingKey(idx.slotId, id));
}
export async function bookingsForSlot(slotId: string): Promise<Booking[]> {
  const keys = await listKeys("bookings", encodeURIComponent(slotId) + "/");
  const out: Booking[] = [];
  for (const k of keys) { const b = await getJSON<Booking>("bookings", k); if (b) out.push(b); }
  return out;
}
export async function activeBookingCounts(slotIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await Promise.all(slotIds.map(async id => { const bs = await bookingsForSlot(id); counts[id] = bs.filter(b => b.status !== "cancelled").length; }));
  return counts;
}

/* Ticket-Guthaben je E-Mail */
export async function getTicket(email: string): Promise<TicketAccount | null> { return getJSON<TicketAccount>("tickets", email); }
export async function saveTicket(t: TicketAccount) { await setJSON("tickets", t.email, t); }
/* Verarbeitete Stripe-Events (Idempotenz) */
export async function seenEvent(id: string): Promise<boolean> { return !!(await getJSON("stripe-events", id)); }
export async function markEvent(id: string) { await setJSON("stripe-events", id, { at: new Date().toISOString() }); }

/* Checkout-Abbrecher (START 39 / BACK 39): Schlüssel = Token aus dem Formular. */
export interface CheckoutLead { token: string; campaign: string; path: string; firstName: string; lastName: string; email: string; phone: string; months?: number; createdAt: string; done?: boolean; mailedAt?: string; leadUuid?: string; customerNumber?: string; utm?: string; abandonedStep?: number; contractId?: string; capi?: { at: string; sent: boolean; status?: number; note?: string };
  /* Kartenweg: Vertragsdaten bis zur Stripe-Bestätigung (Unterschrift wird nach der Vertragsanlage gelöscht) */
  card?: { rateBundleTermId: number; startDate: string; dob: string; street: string; houseNumber: string; zip: string; city: string; signatureSvgBase64?: string; price: number; offerName: string; sourceUrl?: string; fbp?: string; fbc?: string; savedAt: string };
  stripe?: { sessionId?: string; subscriptionId?: string; customerId?: string; paidAt?: string; amount?: number };
  /* Express-Abschluss (Apple Pay, Google Pay, Link direkt auf der Seite): Kontaktdaten kamen aus der Wallet */
  express?: boolean; wallet?: string;
  /* Zahlungsstatus des Stripe-Abos aus dem Webhook: fehlgeschlagene Rechnung, beendetes Abo */
  payment?: { status: "failed" | "cancelled"; at: string; attempts?: number; amount?: number; note?: string };
  contractError?: string }
export async function getCheckoutLead(token: string): Promise<CheckoutLead | null> { return getJSON<CheckoutLead>("checkout-leads", token); }
export async function saveCheckoutLead(l: CheckoutLead) { await setJSON("checkout-leads", l.token, l); }
export async function listCheckoutLeadTokens(): Promise<string[]> { return listKeys("checkout-leads", ""); }
export async function deleteCheckoutLead(token: string) { const s = store("checkout-leads"); if (!s) { mem["checkout-leads"]?.delete(token); return; } await s.delete(token); }

/* Vertragsanlage-Protokoll, Schlüssel = Zeitstempel + Token */
export async function saveCheckoutLog(entry: { at: string; token: string; stage: string }) { await setJSON("checkout-log", `${entry.at}_${entry.token || "anon"}_${entry.stage}`, entry); }

/* Hinweise für das Team (fehlgeschlagene Stripe-Zahlung, beendetes Abo): Blob-Store "stripe-alerts", Schlüssel Zeitpunkt + Art. */
export interface StripeAlert { at: string; kind: "payment_failed" | "subscription_deleted"; token?: string; customerNumber?: string; contractId?: string; name?: string; email?: string; amount?: number; attempts?: number; subscriptionId?: string; mailed: boolean; magicline: string }
export async function saveAlert(a: StripeAlert) { await setJSON("stripe-alerts", `${a.at}_${a.kind}`, a); }
export async function listAlerts(): Promise<StripeAlert[]> { const keys = await listKeys("stripe-alerts", ""); const out: StripeAlert[] = []; for (const k of keys.sort().reverse().slice(0, 100)) { const a = await getJSON<StripeAlert>("stripe-alerts", k); if (a) out.push(a); } return out; }
