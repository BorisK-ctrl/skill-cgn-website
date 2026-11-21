/* Ablage in Netlify Blobs. Lokal ohne Blobs-Kontext: In-Memory-Fallback (nur für den Dev-Server). */
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";
import type { Booking, TicketAccount } from "./types";

/* Sicherheit (Prüfung 19.11.2026): @netlify/blobs setzt den Schlüssel roh in den URL-Pfad und new URL() löst ".." und "%2e%2e" auf,
   "#" und "?" schneiden ab. Ein Schlüssel aus Nutzereingaben (z. B. E-Mail "../../site:tickets/…") könnte so in einen anderen Store schreiben.
   Darum: jeder Schlüssel wird hier geprüft, und Schlüssel aus E-Mails werden gehasht (hashKey). */
const BAD_KEY = /(^|\/)\.{1,2}(\/|$)|%2e|%2f|%5c|%23|%3f|%25|[#?\\\u0000-\u001f\u007f]/i;
export function safeKey(key: string): string {
  if (!key || key.length > 600 || BAD_KEY.test(key)) throw new Error("Ungültiger Speicher-Schlüssel");
  return key;
}
/** Kurzer Hash für Schlüssel aus persönlichen Daten (E-Mail): keine Daten im Schlüssel, kein Pfad-Trick möglich. */
export const hashKey = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

const mem: Record<string, Map<string, unknown>> = {};
function store(name: string) {
  try { return getStore({ name, consistency: "strong" }); } catch { return null; }
}
async function getJSON<T>(name: string, key: string): Promise<T | null> {
  safeKey(key);
  const s = store(name);
  if (!s) return ((mem[name] ||= new Map()).get(key) as T) ?? null;
  return ((await s.get(key, { type: "json" })) as T) ?? null;
}
async function setJSON(name: string, key: string, value: unknown) {
  safeKey(key);
  const s = store(name);
  if (!s) { (mem[name] ||= new Map()).set(key, value); return; }
  await s.setJSON(key, value);
}
async function listKeys(name: string, prefix: string): Promise<string[]> {
  if (prefix) safeKey(prefix);
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
/* Willkommensmail (Issue #2): pendingSince = Abschluss, input = Daten für die Mail, sentAt sobald raus */
export interface WelcomeState { pendingSince: string; customerId?: number; sentAt?: string; skipped?: string; docs?: number; tries?: number; note?: string; input?: { offerName: string; price: number; startDate?: string } }
export interface CheckoutLead { welcome?: WelcomeState; token: string; campaign: string; path: string; firstName: string; lastName: string; email: string; phone: string; months?: number; createdAt: string; done?: boolean; doneAt?: string; mailedAt?: string; page?: string; offer?: string; maxStep?: number; leadUuid?: string; customerNumber?: string; utm?: string; abandonedStep?: number; contractId?: string; capi?: { at: string; sent: boolean; status?: number; note?: string };
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
/** Alle Checkout-Datensätze (30 Tage), zehn gleichzeitig gelesen. Für Tagesbericht und SKILLTOOL2. */
export async function listCheckoutLeads(): Promise<CheckoutLead[]> { return (await listCheckoutLeadsChecked()).leads; }
/** Wie listCheckoutLeads, meldet aber, ob jeder Datensatz gelesen wurde (complete). Die Liste selbst wirft bei Fehlern. */
export async function listCheckoutLeadsChecked(): Promise<{ leads: CheckoutLead[]; complete: boolean }> {
  const tokens = await listCheckoutLeadTokens(), leads: CheckoutLead[] = [];
  let complete = true;
  for (let i = 0; i < tokens.length; i += 10) for (const l of await Promise.all(tokens.slice(i, i + 10).map(t => getCheckoutLead(t).catch(() => { complete = false; return null; })))) if (l) leads.push(l);
  return { leads, complete };
}
export async function deleteCheckoutLead(token: string) { safeKey(token); const s = store("checkout-leads"); if (!s) { mem["checkout-leads"]?.delete(token); return; } await s.delete(token); }
/* SKILLTOOL2 (Dashboard): Werbezahlen, Plan und Notizen je Kampagne, ohne Personendaten. Blob-Store "skilltool2-ads", Schlüssel = Kampagne (bw29). */
export async function getSt2Doc<T>(campaign: string) { return getJSON<T>("skilltool2-ads", campaign); }
export async function saveSt2Doc(campaign: string, doc: unknown) { await setJSON("skilltool2-ads", campaign, doc); }
export async function listSt2Campaigns(): Promise<string[]> { return listKeys("skilltool2-ads", ""); }
/** Kampagnen-Dokument mit Version lesen. Wirft bei Lesefehlern: ein Fehler darf nie als "noch kein Dokument" gelten (Prüfung 21.11.2026). */
export async function getSt2DocVersioned<T>(campaign: string): Promise<{ doc: T | null; etag: string | null }> {
  safeKey(campaign);
  const s = store("skilltool2-ads");
  if (!s) { const v = (mem["skilltool2-ads"] ||= new Map()).get(campaign) as T | undefined; return { doc: v ?? null, etag: v === undefined ? null : String((mem["skilltool2-ads#v"] ||= new Map()).get(campaign) || 1) }; }
  const got = await s.getWithMetadata(campaign, { type: "json" }) as { data: T; etag?: string } | null;
  return { doc: got?.data ?? null, etag: got ? got.etag || null : null };
}
/** Nur schreiben, wenn das Dokument seit dem Lesen unverändert ist (etag) bzw. noch nicht existiert (etag null). false = jemand war schneller. */
export async function saveSt2DocIf(campaign: string, doc: unknown, etag: string | null): Promise<boolean> {
  safeKey(campaign);
  const s = store("skilltool2-ads");
  if (!s) {
    const m = (mem["skilltool2-ads"] ||= new Map()), vm = (mem["skilltool2-ads#v"] ||= new Map());
    const cur = m.has(campaign) ? String(vm.get(campaign) || 1) : null;
    if (cur !== etag) return false;
    m.set(campaign, doc); vm.set(campaign, Number(cur || 0) + 1); return true;
  }
  const r = etag ? await s.setJSON(campaign, doc, { onlyIfMatch: etag }) : await s.setJSON(campaign, doc, { onlyIfNew: true });
  return !!r.modified;
}
/** Fester Schlüssel für die E-Mail-Kennungen im Archiv, einmal zufällig erzeugt, nie gewechselt (unabhängig von SKILLTOOL2_SECRET). */
export async function getSt2ArchiveKey(): Promise<string> {
  const k = "_meta/archive-key";
  const cur = await getJSON<{ key: string }>("skilltool2-sales", k);
  if (cur?.key) return cur.key;
  const fresh = { key: randomBytes(32).toString("hex"), createdAt: new Date().toISOString() };
  const s = store("skilltool2-sales");
  if (!s) { (mem["skilltool2-sales"] ||= new Map()).set(k, fresh); return fresh.key; }
  const r = await s.setJSON(k, fresh, { onlyIfNew: true });
  if (r.modified) return fresh.key;
  const again = await getJSON<{ key: string }>("skilltool2-sales", k);
  if (again?.key) return again.key;
  throw new Error("Archiv-Schlüssel nicht lesbar");
}
/* Sicherung der Verkaufszahlen je Kampagne (eigener Store, damit sie nie mit einem gleichzeitigen Werbezahlen-Eingang kollidiert) */
export async function getSt2Sales<T>(archiveId: string) { return getJSON<T>("skilltool2-sales", archiveId); }
export async function saveSt2Sales(archiveId: string, snap: unknown) { await setJSON("skilltool2-sales", archiveId, snap); }
/* Tagesbericht (sales-report.mts): Zahlen je Tag ohne Personendaten. Bleibt, wenn checkout-leads nach 30 Tagen gelöscht werden. */
export async function saveDailyReport(day: string, summary: unknown) { await setJSON("reports", "tag/" + day, summary); }

/* Vertragsanlage-Protokoll, Schlüssel = Zeitstempel + Token */
export async function saveCheckoutLog(entry: { at: string; token: string; stage: string }) { await setJSON("checkout-log", `${entry.at}_${entry.token || "anon"}_${entry.stage}`, entry); }

/* Hinweise für das Team (fehlgeschlagene Stripe-Zahlung, beendetes Abo): Blob-Store "stripe-alerts", Schlüssel Zeitpunkt + Art. */
export interface StripeAlert { at: string; kind: "payment_failed" | "subscription_deleted"; token?: string; customerNumber?: string; contractId?: string; name?: string; email?: string; amount?: number; attempts?: number; subscriptionId?: string; mailed: boolean; magicline: string }
export async function saveAlert(a: StripeAlert) { await setJSON("stripe-alerts", `${a.at}_${a.kind}`, a); }
export async function listAlerts(): Promise<StripeAlert[]> { const keys = await listKeys("stripe-alerts", ""); const out: StripeAlert[] = []; for (const k of keys.sort().reverse().slice(0, 100)) { const a = await getJSON<StripeAlert>("stripe-alerts", k); if (a) out.push(a); } return out; }

/* ---------- Black Month (Aktion 2026): ein Datensatz je Stripe-Sitzung, Index je E-Mail und Telefon für die Dubletten-Prüfung ---------- */
export interface BlackMonthRecord { sessionId: string; at: string; name: string; email: string; phone: string; amount: number; customerId?: string | null; ref?: string;
  magicline?: string | null; magiclineStatus?: number; duplicateOf?: string; mails: { welcome?: string; staff?: string; nudge?: string; reminder?: string }; appointmentAt?: string | null; capi?: { at: string; sent: boolean; note?: string } }
const phoneKey = (p: string) => { let d = p.replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "49" + d.slice(1); return d; };
export async function getBlackMonth(sessionId: string) { return getJSON<BlackMonthRecord>("blackmonth", "s/" + sessionId); }
export async function saveBlackMonth(r: BlackMonthRecord) {
  await setJSON("blackmonth", "s/" + r.sessionId, r);
  if (r.email) await setJSON("blackmonth", "idx/email/" + r.email.toLowerCase(), { sessionId: r.sessionId });
  const pk = phoneKey(r.phone || ""); if (pk.length >= 8) await setJSON("blackmonth", "idx/phone/" + pk, { sessionId: r.sessionId });
}
/** Frühere Sitzung mit gleicher E-Mail oder Telefonnummer (Dubletten-Prüfung vor dem Magicline-Interessenten). */
export async function findBlackMonthByContact(email: string, phone: string): Promise<string | null> {
  if (email) { const e = await getJSON<{ sessionId: string }>("blackmonth", "idx/email/" + email.toLowerCase()); if (e?.sessionId) return e.sessionId; }
  const pk = phoneKey(phone || ""); if (pk.length >= 8) { const e = await getJSON<{ sessionId: string }>("blackmonth", "idx/phone/" + pk); if (e?.sessionId) return e.sessionId; }
  return null;
}
export async function listBlackMonth(): Promise<BlackMonthRecord[]> {
  const keys = await listKeys("blackmonth", "s/"); const out: BlackMonthRecord[] = [];
  for (const k of keys) { const r = await getJSON<BlackMonthRecord>("blackmonth", k); if (r) out.push(r); }
  return out;
}

/* ---------- Termine mit Coach über die Website (Onboarding): ein Datensatz je Käufer (E-Mail), damit ein Link nicht mehrfach bucht ---------- */
export interface OnboardingRecord { email: string; name: string; phone?: string; offer?: string; ref?: string; kind?: string; start: string; end: string; staff: string; eventId: string; calendarId?: string;
  bookedAt: string; uncertain?: string[]; mails: { customer: boolean; staff: boolean }; cancelledAt?: string; resentAt?: string }
/** Schlüssel je Person: Kleinbuchstaben, ohne +Zusatz, bei Gmail ohne Punkte. Sonst bucht jemand mit a+1@…, a+2@… beliebig oft. */
export function personKey(email: string): string {
  const e = email.trim().toLowerCase(); const at = e.lastIndexOf("@"); if (at < 1) return e;
  let local = e.slice(0, at).split("+")[0], domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") { local = local.replace(/\./g, ""); domain = "gmail.com"; }
  return `${local}@${domain}`;
}
const recKey = (kind: string | undefined, email: string) => (kind === "probetraining" ? "p/" : "e/") + hashKey(personKey(email)); // gehasht, siehe safeKey
/** Buchung je Kunde und Terminart (Onboarding, Probetraining). */
export async function getOnboarding(email: string, kind = "onboarding") { return getJSON<OnboardingRecord>("onboarding", recKey(kind, email)); }
export async function saveOnboarding(r: OnboardingRecord) { await setJSON("onboarding", recKey(r.kind, r.email), r); }

/** Bremse je Schlüssel (z. B. gehashte IP): höchstens limit Aufrufe im Zeitfenster. true = erlaubt.
 *  Atomar über etag (onlyIfMatch/onlyIfNew): gleichzeitige Anfragen können sich nicht gegenseitig überschreiben. Bei Dauerkonflikt: ablehnen. */
/** Treffer im Zeitfenster zählen, ohne einen hinzuzufügen (z. B. Fehlversuche vor der Passwortprüfung). */
export async function hitCount(key: string, windowMs: number): Promise<number> {
  safeKey(key);
  const now = Date.now(), s = store("ratelimit");
  if (!s) return (((mem["ratelimit"]?.get(key) as number[]) || []).filter(t => now - t < windowMs)).length;
  const got = await s.get(key, { type: "json" }) as unknown;
  return (Array.isArray(got) ? (got as number[]) : []).filter(t => now - t < windowMs).length;
}
export async function allowHit(key: string, limit: number, windowMs: number): Promise<boolean> {
  safeKey(key);
  const now = Date.now();
  const s = store("ratelimit");
  if (!s) {
    const m = (mem["ratelimit"] ||= new Map()); const cur = ((m.get(key) as number[]) || []).filter(t => now - t < windowMs);
    if (cur.length >= limit) return false; cur.push(now); m.set(key, cur); return true;
  }
  for (let i = 0; i < 6; i++) {
    const got = await s.getWithMetadata(key, { type: "json" }) as { data: unknown; etag?: string } | null;
    const cur = (Array.isArray(got?.data) ? (got!.data as number[]) : []).filter(t => now - t < windowMs);
    if (cur.length >= limit) return false;
    cur.push(now);
    const r = got?.etag ? await s.setJSON(key, cur, { onlyIfMatch: got.etag }) : await s.setJSON(key, cur, { onlyIfNew: true });
    if (r.modified) return true;
  }
  return false;
}

/* ---------- Kurze Sperren (Netlify Blobs, starke Konsistenz): immer nur eine Buchung je Kunde und je Rasterzelle gleichzeitig ----------
   Erwerb mit onlyIfNew; eine Sperre älter als ttlMs gilt als verwaist (Funktion abgebrochen) und wird per onlyIfMatch übernommen. */
const lockMem = new Map<string, number>();
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  safeKey(key);
  const owner = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const s = store("locks");
  if (!s) { const t = lockMem.get(key); if (t && Date.now() - t < ttlMs) return null; lockMem.set(key, Date.now()); return owner; }
  const r = await s.setJSON(key, { owner, at: Date.now() }, { onlyIfNew: true });
  if (r.modified) return owner;
  const cur = await s.getWithMetadata(key, { type: "json" }) as { data: { owner: string; at: number } | null; etag?: string } | null;
  if (!cur?.data) { const again = await s.setJSON(key, { owner, at: Date.now() }, { onlyIfNew: true }); return again.modified ? owner : null; }
  if (Date.now() - Number(cur.data.at || 0) < ttlMs || !cur.etag) return null;
  const take = await s.setJSON(key, { owner, at: Date.now() }, { onlyIfMatch: cur.etag });
  return take.modified ? owner : null;
}
export async function releaseLock(key: string, owner: string) {
  safeKey(key);
  const s = store("locks");
  if (!s) { lockMem.delete(key); return; }
  try { const cur = await s.get(key, { type: "json" }) as { owner?: string } | null; if (cur?.owner === owner) await s.delete(key); } catch (e) { console.log("releaseLock", key, String(e)); }
}

/* ---------- Wunschtermine Onboarding und Probetraining (lib/anfrage.ts): letzte Anfrage je Person und Art. Ein Doppeltipp löst keine zweite Mail aus,
   eine fehlgeschlagene Mail wird beim nächsten Tipp nachgeholt. ---------- */
/* Nur was der Doppeltipp-Schutz braucht, keine Namen, Telefonnummern oder Anmerkungen. Schlüssel gehasht. */
export interface AnfrageRecord { kind?: string; start: string; at: string; fp?: string; earlier?: string; customerAt?: string; mails: { staff: boolean; customer: boolean } }
const anfrageKey = (kind: string | undefined, email: string) => (kind === "probetraining" ? "ap/" : "a/") + hashKey(personKey(email));
export async function getAnfrage(email: string, kind = "onboarding") { return getJSON<AnfrageRecord>("onboarding", anfrageKey(kind, email)); }
export async function saveAnfrage(email: string, r: AnfrageRecord) { await setJSON("onboarding", anfrageKey(r.kind, email), r); }
