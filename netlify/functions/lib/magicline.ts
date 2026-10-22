/* Magicline Open API (https://developer.sportalliance.com/apis/magicline/openapi). Key nur serverseitig, aus Netlify-Umgebungsvariablen. */
import type { Slot } from "./types";

const TENANT = process.env.MAGICLINE_TENANT || "skillathletic";
const KEY = process.env.MAGICLINE_OPEN_API_KEY || "";
const BASE = `https://${TENANT}.open-api.magicline.com/v1`;
export const magiclineConfigured = () => KEY.length > 10;

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, { method, headers: { "x-api-key": KEY, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let data: any = null; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`Magicline ${method} ${path} ${r.status}: ${typeof data === "string" ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`);
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
export async function validateBooking(customerId: number, classSlotId: number): Promise<{ bookable: boolean; raw: any }> {
  const raw = await api<any>("POST", "/classes/booking/validate", { customerId, classSlotId });
  return { bookable: raw?.bookable !== false && !(raw?.errors?.length), raw };
}
export async function bookSlot(customerId: number, classSlotId: number): Promise<number> {
  const r = await api<any>("POST", "/classes/booking/book", { customerId, classSlotId });
  return Number(r?.bookingId ?? r?.id);
}
export async function cancelBooking(bookingId: number) { await api("DELETE", `/classes/booking/${bookingId}`); }
