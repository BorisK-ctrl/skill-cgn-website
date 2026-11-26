/* Magicline Open API (https://developer.sportalliance.com/apis/magicline/openapi). Key nur serverseitig, aus Netlify-Umgebungsvariablen. */
import type { Slot } from "./types";

const TENANT = process.env.MAGICLINE_TENANT || "skillathletic";
const KEY = process.env.MAGICLINE_OPEN_API_KEY || "";
const BASE = `https://${TENANT}.open-api.magicline.com/v1`;
export const magiclineConfigured = () => KEY.length > 10;

/** Fehler der Open API mit HTTP-Status (status 0: keine Antwort, etwa Zeitüberschreitung). */
export class MagiclineError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function api<T>(method: string, path: string, body?: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  let r: Response;
  try { r = await fetch(BASE + path, { method, headers: { "x-api-key": KEY, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}) }); }
  catch (e) { throw new MagiclineError(`Magicline ${method} ${path}: keine Antwort (${String((e as Error)?.name || e)})`, 0); }
  const text = await r.text(); let data: any = null; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new MagiclineError(`Magicline ${method} ${path} ${r.status}: ${typeof data === "string" ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`, r.status);
  return data as T;
}

/** Kursplan-Slots für [from, from + days). Magicline erlaubt daysAhead 0–6, daher tageweise gestückelt. */
export async function listSlots(fromDate: string, days: number): Promise<Slot[]> {
  const out: Slot[] = [];
  let offset = "0";
  for (;;) {
    const page = await api<{ result: any[]; hasNext: boolean; offset: string }>("GET", `/classes/slots?slotWindowStartDate=${fromDate}&daysAhead=${Math.min(6, Math.max(0, days - 1))}&sliceSize=100&offset=${encodeURIComponent(offset)}`);
    for (const s of page.result || []) {
      const booked = (s.bookedParticipants || 0) + (s.additionalParticipants || 0);
      out.push({ id: String(s.id), name: s.classInformation?.name || "Class", description: s.classInformation?.description || undefined,
        start: s.startDateTime, end: s.endDateTime, trainer: (s.instructors || []).map((i: any) => [i.firstName, i.lastName].filter(Boolean).join(" ")).filter(Boolean).join(", ") || "Coach",
        max: s.maxParticipants || 0, booked, free: Math.max(0, (s.maxParticipants || 0) - booked), bookable: !!s.bookable, source: "magicline" });
    }
    if (!page.hasNext) break; offset = page.offset;
  }
  return out;
}
export async function findCustomerByEmail(email: string): Promise<{ id: number; status: string; firstName: string; lastName: string } | null> {
  const res = await api<any>("POST", "/customers/search", { email });
  const list: any[] = Array.isArray(res) ? res : res?.result || res?.content || [];
  const hit = list.find(c => String(c.email || "").toLowerCase() === email.toLowerCase()) || list[0];
  return hit ? { id: hit.id, status: hit.status, firstName: hit.firstName, lastName: hit.lastName } : null;
}
/* Kundensuche für den Vor-Ort-Abschluss (netlify/functions/vor-ort.mts): POST /v1/customers/search, Scope CUSTOMER_READ, höchstens 100 Treffer.
   Vor- und Nachname vergleicht Magicline ab dem Anfang, E-Mail und Telefon als ganzen Wert. Interessenten haben den Status PROSPECT. */
export interface MlCustomer { id: number; customerNumber?: string; firstName?: string; lastName?: string; dateOfBirth?: string; email?: string;
  street?: string; houseNumber?: string; zipCode?: string; city?: string; status?: string; uuid?: string; createdDateTime?: string;
  phonePrivate?: string; phonePrivateMobile?: string; phoneBusiness?: string; phoneBusinessMobile?: string }
export async function searchCustomers(criteria: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string }): Promise<MlCustomer[]> {
  const res = await api<any>("POST", "/customers/search", criteria, { timeoutMs: 8000 });
  return (Array.isArray(res) ? res : res?.result || res?.content || []).filter((c: any) => c && typeof c.id === "number");
}
export async function getCustomer(id: number): Promise<MlCustomer> { return api<MlCustomer>("GET", `/customers/${id}`, undefined, { timeoutMs: 8000 }); }
export async function validateBooking(customerId: number, classSlotId: number): Promise<{ bookable: boolean; raw: any }> {
  const raw = await api<any>("POST", "/classes/booking/validate", { customerId, classSlotId });
  return { bookable: raw?.bookable !== false && !(raw?.errors?.length), raw };
}
export async function bookSlot(customerId: number, classSlotId: number): Promise<number> {
  const r = await api<any>("POST", "/classes/booking/book", { customerId, classSlotId });
  return Number(r?.bookingId ?? r?.id);
}
export async function cancelBooking(bookingId: number) { await api("DELETE", `/classes/booking/${bookingId}`); }

/* Kundendokumente (Issue #2): GET /v1/customers/{customerId}/documents, je Eintrag id, fileName, description, createdDateTime
   und url (Download, 15 Minuten gültig). Einem Vertrag lassen sich Dokumente nicht direkt zuordnen, daher über die Erstellungszeit. */
export interface CustomerDocument { id: number; fileName: string; description?: string; createdDateTime?: string; url?: string }
export async function listCustomerDocuments(customerId: number): Promise<CustomerDocument[]> {
  const out: CustomerDocument[] = []; let offset = "0";
  for (let i = 0; i < 10; i++) {
    const page = await api<{ result: CustomerDocument[]; hasNext: boolean; offset: string }>("GET", `/customers/${customerId}/documents?sliceSize=50&offset=${encodeURIComponent(offset)}`);
    out.push(...(page.result || []));
    if (!page.hasNext) break; offset = page.offset;
  }
  return out;
}
/** Dokument über die signierte URL laden (Base64 für Resend attachments). */
export async function downloadDocument(url: string): Promise<{ base64: string; bytes: number; contentType: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Dokument-Download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { base64: buf.toString("base64"), bytes: buf.length, contentType: r.headers.get("content-type") || "application/pdf" };
}
