/* Gemeinsamer Buchungskern für Onboarding (90 Min) und Probetraining (30 Min): freie Zeiten je Tag (immer live aus Google), Termin eintragen,
   Kalenderlinks für den Kunden. Verfügbarkeit in ./onboarding.ts (computeSlots), Kalenderzugriff in ./gcal.ts.

   Schutz gegen Doppelbuchungen: Jede Buchung sperrt kurz alle 30-Minuten-Zellen, die ihr Termin berührt (Netlify Blobs, starke Konsistenz).
   Zwei Buchungen, die sich überschneiden, teilen mindestens eine Zelle und laufen deshalb nacheinander. Die zweite lädt die Kalender erst,
   wenn die erste eingetragen ist, und sieht deren Termin. Überschneidungen über Onboarding und Probetraining hinweg sind damit auch abgedeckt. */
import { berlinDate, berlinToDate, addDays, SITE } from "./util";
import { insertEvent, listEvents, getEvent } from "./gcal";
import { computeSlots, pickStaff, signData, unclearAt, KINDS, HORIZON_DAYS, STEP_MIN, STAFF, type Kind, type Staff } from "./onboarding";
import { loadCalData } from "./onboarding-live";
import { acquireLock, releaseLock, getOnboarding, saveOnboarding, type OnboardingRecord } from "./store";

export interface Person { name: string; email: string; phone?: string; offer?: string; ref?: string; notes?: string[] }
export type BookResult = { ok: true; start: string; end: string; staff: Staff; eventId: string; calendarId: string; uncertain: string[] } | { ok: false; status: number; error: string };

const STEP = STEP_MIN * 60000;
const durationMs = (kind: Kind) => Math.ceil(KINDS[kind].durationMin / STEP_MIN) * STEP;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const GONE = "Diese Zeit ist gerade weggegangen. Bitte wähle eine andere.";

/** Freie Starts der nächsten drei Wochen, je Berliner Tag. Mitarbeiter werden nicht herausgegeben. */
export async function freeByDay(kind: Kind, now = new Date()) {
  const k = KINDS[kind]; const to = new Date(now.getTime() + HORIZON_DAYS * 86400000);
  const slots = computeSlots(await loadCalData(now, to), { from: now, to, now, durationMin: k.durationMin, leadHours: k.leadHours });
  const byDay: Record<string, { start: string; end: string }[]> = {};
  for (const s of slots) (byDay[berlinDate(new Date(s.start))] ||= []).push({ start: s.start, end: s.end });
  return byDay;
}

/** Start prüfen: im 30-Minuten-Raster, nicht vor Vorlauf, nicht nach Horizont. */
export function checkStart(kind: Kind, startIso: unknown, now = Date.now()): { ok: true; startMs: number } | { ok: false; status: number; error: string } {
  const startMs = typeof startIso === "string" ? Date.parse(startIso) : NaN;
  if (!Number.isFinite(startMs) || startMs % STEP !== 0) return { ok: false, status: 400, error: "Bitte eine Zeit aus der Liste wählen." };
  if (startMs < now + KINDS[kind].leadHours * 3600000 || startMs > now + HORIZON_DAYS * 86400000) return { ok: false, status: 409, error: GONE };
  return { ok: true, startMs };
}

/** Termin eintragen: Zellen sperren, Kalender frisch laden, Verfügbarkeit neu rechnen, Coach wählen, eintragen, Sperren lösen. */
export async function bookAppointment(kind: Kind, p: Person, startIso: string): Promise<BookResult> {
  const k = KINDS[kind];
  const chk = checkStart(kind, startIso); if (!chk.ok) return chk;
  const startMs = chk.startMs, start = new Date(startMs).toISOString(), end = new Date(startMs + durationMs(kind)).toISOString();

  /* Alle Zellen des Termins sperren (gut 2 s warten, falls gerade jemand anderes dieselbe Zeit bucht) */
  const cells: string[] = []; for (let t = startMs; t < startMs + durationMs(kind); t += STEP) cells.push("cell/" + new Date(t).toISOString());
  const held: [string, string][] = [];
  const release = () => Promise.all(held.map(([key, owner]) => releaseLock(key, owner)));
  try {
    for (const cell of cells) {
      let owner: string | null = null;
      for (let i = 0; i < 8 && !owner; i++) { owner = await acquireLock(cell, 30000); if (!owner) await sleep(300); }
      if (!owner) return { ok: false, status: 409, error: "Gerade bucht jemand diese Zeit. Bitte versuch es gleich noch einmal oder wähle eine andere." };
      held.push([cell, owner]);
    }
    const day = berlinDate(new Date(startMs)); const from = berlinToDate(day, "00:00"), to = berlinToDate(addDays(day, 1), "00:00");
    let data;
    try { data = await loadCalData(from, to); } catch (e) { console.log(`${kind}-book load`, String(e)); return { ok: false, status: 502, error: "Kalender gerade nicht erreichbar. Bitte gleich noch einmal versuchen." }; }
    const slot = computeSlots(data, { from, to, durationMin: k.durationMin, leadHours: k.leadHours }).find(s => s.start === start);
    const staff = slot && pickStaff(slot);
    if (!slot || !staff) return { ok: false, status: 409, error: GONE };
    const uncertain = slot.uncertain ? unclearAt(data, start, end) : [];

    const lines = [`${k.label} über skill-studios.com`, `Coach: ${staff.full}`, `Kunde: ${p.name}`, `E-Mail: ${p.email}`, p.phone ? `Telefon: ${p.phone}` : "", p.offer ? `Angebot: ${p.offer}` : "", p.ref ? `Referenz: ${p.ref}` : "",
      uncertain.length ? `Bitte prüfen: gleichzeitig ohne sicheren Coach im Kalender: ${uncertain.join(", ")}` : "", ...(p.notes || [])].filter(Boolean);
    let ev: any;
    try {
      ev = await insertEvent(k.calendar, { summary: `${p.name} - ${k.label} (${staff.name})`, description: lines.join("\n"), location: "SKILL CGN, Herzogstraße 16–20, 50667 Köln",
        start: { dateTime: start, timeZone: "Europe/Berlin" }, end: { dateTime: end, timeZone: "Europe/Berlin" },
        extendedProperties: { private: { source: k.source, staff: staff.key, email: p.email.trim().toLowerCase(), kind } } });
    } catch (e) { console.log(`${kind}-book insert`, String(e)); return { ok: false, status: 502, error: "Termin konnte nicht eingetragen werden. Bitte gleich noch einmal versuchen." }; }
    return { ok: true, start, end, staff, eventId: ev.id, calendarId: k.calendar, uncertain };
  } finally { await release().catch(() => {}); }
}

/** Website-Termin dieses Kunden in der Zukunft (z. B. nach abgebrochener Antwort schon eingetragen). */
export async function findWebsiteBooking(kind: Kind, email: string): Promise<{ id: string; start: string; end: string; staff?: string } | null> {
  const k = KINDS[kind], now = new Date();
  const items = await listEvents(k.calendar, now, new Date(now.getTime() + (HORIZON_DAYS + 2) * 86400000), { privateExtendedProperty: `email=${email.trim().toLowerCase()}` });
  const ev = items.filter(e => e.extendedProperties?.private?.source === k.source && e.start?.dateTime).sort((a, b) => Date.parse(a.start.dateTime) - Date.parse(b.start.dateTime))[0];
  return ev ? { id: ev.id, start: new Date(ev.start.dateTime).toISOString(), end: new Date(ev.end.dateTime).toISOString(), staff: ev.extendedProperties?.private?.staff } : null;
}

/** Stand der Onboarding-Buchung eines Kunden, abgeglichen mit dem Kalender: vom Team gelöscht = wieder buchbar, verschoben = neue Zeit. */
export type BookingState = { state: "none" } | { state: "booked" | "past"; rec: OnboardingRecord };
export async function currentBooking(email: string): Promise<BookingState> {
  const rec = await getOnboarding(email);
  if (!rec || rec.cancelledAt) return { state: "none" };
  let ev: any;
  try { ev = await getEvent(rec.calendarId || KINDS.onboarding.calendar, rec.eventId); } catch (e) { console.log("currentBooking getEvent", String(e)); ev = undefined; }
  if (ev === null) { rec.cancelledAt = new Date().toISOString(); await saveOnboarding(rec); return { state: "none" }; }
  if (ev?.start?.dateTime && ev?.end?.dateTime) {
    const s = new Date(ev.start.dateTime).toISOString(), e = new Date(ev.end.dateTime).toISOString();
    if (s !== rec.start || e !== rec.end) { rec.start = s; rec.end = e; await saveOnboarding(rec); }
  }
  return { state: Date.parse(rec.end) > Date.now() ? "booked" : "past", rec };
}
/** Antwort für die Seite: gebuchter Termin mit Coach-Vorname und Kalenderlinks. */
export const bookedView = (rec: { start: string; end: string; staff?: string }) =>
  ({ start: rec.start, end: rec.end, coach: STAFF.find(s => s.key === rec.staff)?.name, google: googleCalLink("onboarding", rec.start, rec.end), ics: icsLink("onboarding", rec.start, rec.end) });

/* ---------- Kalender des Kunden: Google-Vorlage und .ics (Apple, Outlook) ---------- */
const TITLES: Record<Kind, string> = { onboarding: "Onboarding bei SKILL CGN", probetraining: "Probetraining bei SKILL CGN" };
const DETAILS = "Mitbringen: Sportklamotten und saubere Hallenschuhe. Handtuch, Getränke und Dusche haben wir. Fragen: WhatsApp 0176 10877603.";
const ADDRESS = "SKILL CGN, Herzogstraße 16-20, 50667 Köln";
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function googleCalLink(kind: Kind, start: string, end: string) {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(TITLES[kind])}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(ADDRESS)}&details=${encodeURIComponent(DETAILS + " skill-studios.com")}`;
}
export function icsLink(kind: Kind, start: string, end: string) { return `${SITE}/api/termin.ics?d=${signData({ k: kind, s: start, e: end })}`; }
export function icsFile(kind: Kind, start: string, end: string) {
  const esc = (t: string) => t.replace(/[,;\\]/g, m => "\\" + m);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SKILL CGN//Termine//DE", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${stamp(start)}-${kind}@skill-studios.com`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(TITLES[kind])}`, `LOCATION:${esc(ADDRESS)}`, `DESCRIPTION:${esc(DETAILS)}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(TITLES[kind])}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
