/* Gemeinsamer Buchungskern für Onboarding und Probetraining: freie Zeiten je Tag, Termin eintragen mit Gegenprobe, Kalenderlinks.
   Verfügbarkeit in ./onboarding.ts (computeSlots), Kalenderzugriff in ./gcal.ts. */
import { berlinDate, berlinToDate, addDays, SITE } from "./util";
import { insertEvent, deleteEvent, listEvents } from "./gcal";
import { computeSlots, pickStaff, signData, KINDS, HORIZON_DAYS, type Kind, type Staff } from "./onboarding";
import { loadCalData } from "./onboarding-live";

export interface Person { name: string; email: string; phone?: string; offer?: string; ref?: string; notes?: string[] }
export type BookResult = { ok: true; start: string; end: string; staff: Staff; eventId: string } | { ok: false; status: number; error: string };

/** Freie Starts der nächsten drei Wochen, je Berliner Tag. Mitarbeiter werden nicht herausgegeben. */
export async function freeByDay(kind: Kind) {
  const k = KINDS[kind]; const from = new Date(), to = new Date(Date.now() + HORIZON_DAYS * 86400000);
  const slots = computeSlots(await loadCalData(from, to), { from, to, durationMin: k.durationMin, leadHours: k.leadHours });
  const byDay: Record<string, { start: string; end: string }[]> = {};
  for (const s of slots) (byDay[berlinDate(new Date(s.start))] ||= []).push({ start: s.start, end: s.end });
  return byDay;
}

const GONE = "Dieser Termin ist gerade weggegangen. Bitte wähle einen anderen.";
/** Termin eintragen: Verfügbarkeit frisch berechnen, Mitarbeiter wählen, eintragen, Gegenprobe gegen gleichzeitige Buchung beim selben Mitarbeiter. */
export async function bookAppointment(kind: Kind, p: Person, startIso: string): Promise<BookResult> {
  const k = KINDS[kind]; const startMs = Date.parse(startIso);
  if (!startMs) return { ok: false, status: 400, error: "Bitte einen Termin wählen." };
  const start = new Date(startMs).toISOString(), end = new Date(startMs + k.durationMin * 60000).toISOString();
  const day = berlinDate(new Date(startMs)); const from = berlinToDate(day, "00:00"), to = berlinToDate(addDays(day, 1), "00:00");
  let data;
  try { data = await loadCalData(from, to); } catch (e) { console.log(`${kind}-book load`, String(e)); return { ok: false, status: 502, error: "Kalender gerade nicht erreichbar. Bitte gleich noch einmal versuchen." }; }
  const slot = computeSlots(data, { from, to, durationMin: k.durationMin, leadHours: k.leadHours }).find(s => s.start === start);
  const staff = slot && pickStaff(slot, data.appointments);
  if (!slot || !staff) return { ok: false, status: 409, error: GONE };

  const lines = [`${k.label} über skill-studios.com`, `Coach: ${staff.full}`, `Kunde: ${p.name}`, `E-Mail: ${p.email}`, p.phone ? `Telefon: ${p.phone}` : "", p.offer ? `Angebot: ${p.offer}` : "", p.ref ? `Referenz: ${p.ref}` : "", ...(p.notes || [])].filter(Boolean);
  let ev: any;
  try {
    ev = await insertEvent(k.calendar, { summary: `${p.name} - ${k.label} (${staff.name})`, description: lines.join("\n"), location: "SKILL CGN, Herzogstraße 16–20, 50667 Köln",
      start: { dateTime: start, timeZone: "Europe/Berlin" }, end: { dateTime: end, timeZone: "Europe/Berlin" }, extendedProperties: { private: { source: k.source, staff: staff.key, email: p.email } } });
  } catch (e) { console.log(`${kind}-book insert`, String(e)); return { ok: false, status: 502, error: "Termin konnte nicht eingetragen werden. Bitte gleich noch einmal versuchen." }; }
  try {
    const clash = (await listEvents(k.calendar, new Date(startMs), new Date(end)))
      .filter(e => e.extendedProperties?.private?.source === k.source && e.extendedProperties?.private?.staff === staff.key)
      .sort((a, c) => String(a.created).localeCompare(String(c.created)) || String(a.id).localeCompare(String(c.id)));
    if (clash.length > 1 && clash[0].id !== ev.id) { await deleteEvent(k.calendar, ev.id); return { ok: false, status: 409, error: GONE }; }
  } catch (e) { console.log(`${kind}-book gegenprobe`, String(e)); }
  return { ok: true, start, end, staff, eventId: ev.id };
}

/* ---------- Kalender des Kunden: Google-Vorlage und .ics (Apple, Outlook) ---------- */
const TITLES: Record<Kind, string> = { onboarding: "Onboarding bei SKILL CGN", probetraining: "Probetraining bei SKILL CGN" };
const ADDRESS = "SKILL CGN, Herzogstraße 16-20, 50667 Köln";
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function googleCalLink(kind: Kind, start: string, end: string) {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(TITLES[kind])}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(ADDRESS)}&details=${encodeURIComponent("Sportsachen, saubere Hallenschuhe und Handtuch mitbringen. Bitte 10 Minuten früher da sein. skill-studios.com")}`;
}
export function icsLink(kind: Kind, start: string, end: string) { return `${SITE}/api/termin.ics?d=${signData({ k: kind, s: start, e: end })}`; }
export function icsFile(kind: Kind, start: string, end: string) {
  const esc = (t: string) => t.replace(/[,;\\]/g, m => "\\" + m);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SKILL CGN//Termine//DE", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${stamp(start)}-${kind}@skill-studios.com`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(TITLES[kind])}`, `LOCATION:${esc(ADDRESS)}`, `DESCRIPTION:${esc("Sportsachen, saubere Hallenschuhe und Handtuch mitbringen. Bitte 10 Minuten früher da sein.")}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(TITLES[kind])}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
