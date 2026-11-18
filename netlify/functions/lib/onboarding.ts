/* Onboarding-Termine (90 Min) nach Abschluss einer Mitgliedschaft. Reine Logik ohne Netzwerk, damit sie gegen echte Kalenderdaten testbar ist
   (scripts/test-onboarding-slots.mjs). Regel (Boris, 2026-11-14): Ein Mitarbeiter ist frei, wenn er im Kalender SERVICE eine Schicht hat,
   die den ganzen Termin abdeckt, und in dieser Zeit keinen eigenen Kurs (SKILL Classes), keine Abwesenheit und keinen anderen Termin hat.
   Ein Termin ist buchbar, wenn mindestens ein Onboarding-Mitarbeiter frei ist. Termine ohne erkennbaren Mitarbeiter (z. B. "Personal Training Skill")
   belegen vorsichtshalber einen der freien Mitarbeiter. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { berlinToDate, berlinDate, addDays } from "./util";

export interface Staff { key: string; name: string; full: string; emails: string[] }
/** Wer Onboardings macht (Scan, Einweisung, Trainingsplan). Reihenfolge = Vorrang bei Gleichstand. */
export const STAFF: Staff[] = [
  { key: "peter", name: "Peter", full: "Peter Schaale", emails: ["p.schaale@outlook.com"] },
  { key: "nic", name: "Nic", full: "Nic Müller", emails: ["nicmueller2001@gmail.com"] },
  { key: "noah", name: "Noah", full: "Noah Wengenroth", emails: ["wengenrothnoah@gmail.com"] },
  { key: "boris", name: "Boris", full: "Boris Kurowski", emails: ["boris.kurowski@gmail.com", "boris.k@skill-studios.com"] },
];
export const CALENDARS = {
  service: "c_03da334cdae727c1bbc66f80fdf15ba4b89ff4373699a4a49604d654a7fb5b53@group.calendar.google.com",
  classes: "c_7cc0ae41a2adbe7729eb7e814141aa9506940dea0351dae300a6caa33cb1a916@group.calendar.google.com",
  onboarding: "c_9251c5d9f2fdb7bf2dd82c0e8614a83f5271de3f3df7ce73417c8c572892e9bd@group.calendar.google.com",
  probetraining: "c_e279c7fea8188faef6b25641272f630312cde07f505ffcabfb4f1bc3117a4d15@group.calendar.google.com",
  absences: ["c_5ebef3d12c85fb6383f61f5b1da9f4ff17ced0381db9a6884aca28d8aa237329@group.calendar.google.com", "c_7f486f3269c0fafd67cb6ba6f016b105dbbefbf914005dcc33db5f3820c83540@group.calendar.google.com"],
  /* Onboarding, Probetraining, Personal Training, Erstgespräch, Six Week onboarding */
  appointments: ["c_9251c5d9f2fdb7bf2dd82c0e8614a83f5271de3f3df7ce73417c8c572892e9bd@group.calendar.google.com", "c_e279c7fea8188faef6b25641272f630312cde07f505ffcabfb4f1bc3117a4d15@group.calendar.google.com",
    "c_f9556f6198dac5de06bc51d128a672ee696e468524829e67f2838f4f0b3bcb4a@group.calendar.google.com", "c_a9779d468a029e3f51ee3f46f4d199b4540f92eb4056cdd8cbca56747ae6cb89@group.calendar.google.com",
    "c_fdeef1e9e7a842a331724120ca2c94b407e98294f721e42ca127ea6c3be7a152@group.calendar.google.com"],
};
export const DURATION_MIN = 90, STEP_MIN = 30, LEAD_HOURS = 12, HORIZON_DAYS = 21;

/** Terminarten. Probetraining (Boris, 2026-11-18): dieselben vier Coaches, nur wenn der Coach in der Zeit keinen Kurs gibt; 60 Minuten. */
export const KINDS = {
  onboarding: { label: "Onboarding", calendar: CALENDARS.onboarding, durationMin: 90, leadHours: 12, source: "website-onboarding" },
  probetraining: { label: "Probetraining", calendar: CALENDARS.probetraining, durationMin: 60, leadHours: 3, source: "website-probetraining" },
} as const;
export type Kind = keyof typeof KINDS;

/** Google-Kalender-Termin, so wie events.list ihn liefert (nur die Felder, die hier zählen). */
export interface GEvent { id?: string; created?: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; responseStatus?: string }[]; extendedProperties?: { private?: Record<string, string> } }
export interface CalData { service: GEvent[]; classes: GEvent[]; absences: GEvent[]; appointments: GEvent[] }
interface Span { s: number; e: number }
export interface OnbSlot { start: string; end: string; staff: string[] }

const allDay = (ev: GEvent) => !ev.start?.dateTime && !!ev.start?.date;
function span(ev: GEvent): Span | null {
  if (ev.start?.dateTime && ev.end?.dateTime) return { s: Date.parse(ev.start.dateTime), e: Date.parse(ev.end.dateTime) };
  if (ev.start?.date) return { s: berlinToDate(ev.start.date, "00:00").getTime(), e: berlinToDate(ev.end?.date || addDays(ev.start.date, 1), "00:00").getTime() };
  return null;
}
const word = (name: string) => new RegExp(`(^|[^\\p{L}])${name}([^\\p{L}]|$)`, "iu");
/** Mitarbeiter eines Termins: eigene Markierung, sonst Titel, sonst Gäste (ohne Absagen), sonst Beschreibung. Kein Treffer = []. */
export function staffOf(ev: GEvent): string[] {
  const own = ev.extendedProperties?.private?.staff; if (own && STAFF.some(s => s.key === own)) return [own];
  const byText = (t: string) => STAFF.filter(s => word(s.name).test(t)).map(s => s.key);
  const title = byText(ev.summary || ""); if (title.length) return title;
  const guests = STAFF.filter(s => (ev.attendees || []).some(a => a.responseStatus !== "declined" && s.emails.includes((a.email || "").toLowerCase()))).map(s => s.key);
  if (guests.length) return guests;
  return byText(ev.description || "");
}
/** Kurs mit benanntem Coach außerhalb des Onboarding-Teams ("Coach: Antonia Warlich" oder "HYROX — Antonia Warlich"). */
function otherCoach(ev: GEvent): boolean {
  const coach = (ev.description || "").match(/Coach:\s*([^\n]+)/)?.[1] || (ev.summary || "").split(/\s+[—–-]\s+/)[1] || "";
  return !!coach.trim() && !/offen/i.test(coach);
}
const overlaps = (a: Span, b: Span) => a.s < b.e && a.e > b.s;
function merge(list: Span[]): Span[] {
  const out: Span[] = [];
  for (const x of [...list].sort((a, b) => a.s - b.s)) { const last = out[out.length - 1]; if (last && x.s <= last.e) last.e = Math.max(last.e, x.e); else out.push({ ...x }); }
  return out;
}

/** Buchbare Starts im Zeitraum, je Start die freien Mitarbeiter. */
export function computeSlots(d: CalData, o: { from: Date; to: Date; now?: Date; durationMin?: number; stepMin?: number; leadHours?: number }): OnbSlot[] {
  const dur = (o.durationMin ?? DURATION_MIN) * 60000, step = (o.stepMin ?? STEP_MIN) * 60000;
  const earliest = Math.max(o.from.getTime(), (o.now ?? new Date()).getTime() + (o.leadHours ?? LEAD_HOURS) * 3600000), latest = o.to.getTime();
  const shifts: Record<string, Span[]> = {}, busy: Record<string, Span[]> = {}; const generic: Span[] = [];
  for (const s of STAFF) { shifts[s.key] = []; busy[s.key] = []; }
  /* SERVICE: Schichten mit Uhrzeit; ganztägige Einträge ("Nic Uni", "Nic Prüfung") sind Abwesenheiten */
  for (const ev of d.service) { const sp = span(ev); if (!sp) continue; for (const k of staffOf(ev)) (allDay(ev) ? busy : shifts)[k].push(sp); }
  for (const ev of d.absences) { const sp = span(ev); if (sp) for (const k of staffOf(ev)) busy[k].push(sp); }
  /* Kurse: eigener Coach belegt ihn. Kurs eines anderen Coaches (Antonia, Fabian …) belegt niemanden, Kurs ohne Coach ("COACH OFFEN") irgendeinen. */
  for (const ev of d.classes) { const sp = span(ev); if (!sp) continue; const ks = staffOf(ev); if (ks.length) for (const k of ks) busy[k].push(sp); else if (!otherCoach(ev)) generic.push(sp); }
  /* Termine: eigener Mitarbeiter belegt, sonst unbekannt (belegt irgendeinen) */
  for (const ev of d.appointments) { const sp = span(ev); if (!sp) continue; const ks = staffOf(ev); if (ks.length) for (const k of ks) busy[k].push(sp); else generic.push(sp); }
  for (const k in shifts) shifts[k] = merge(shifts[k]);

  /* Kandidaten: halbstündliches Raster innerhalb jeder Schicht */
  const starts = new Set<number>();
  for (const k in shifts) for (const sh of shifts[k]) for (let t = Math.ceil(sh.s / step) * step; t + dur <= sh.e; t += step) if (t >= earliest && t + dur <= latest) starts.add(t);
  const out: OnbSlot[] = [];
  for (const t of [...starts].sort((a, b) => a - b)) {
    const slot = { s: t, e: t + dur };
    const free = STAFF.filter(st => shifts[st.key].some(sh => sh.s <= slot.s && sh.e >= slot.e) && !busy[st.key].some(b => overlaps(b, slot))).map(st => st.key);
    const unknown = generic.filter(g => overlaps(g, slot)).length;
    if (free.length > unknown) out.push({ start: new Date(slot.s).toISOString(), end: new Date(slot.e).toISOString(), staff: free });
  }
  return out;
}

/** Mitarbeiter für einen Start: der freie mit den wenigsten eigenen Terminen an dem Tag, bei Gleichstand nach Reihenfolge in STAFF. */
export function pickStaff(slot: OnbSlot, appointments: GEvent[]): Staff | null {
  const day = berlinDate(new Date(slot.start));
  const load = (k: string) => appointments.filter(ev => { const sp = span(ev); return sp && berlinDate(new Date(sp.s)) === day && staffOf(ev).includes(k); }).length;
  const cands = STAFF.filter(s => slot.staff.includes(s.key)).sort((a, b) => load(a.key) - load(b.key));
  return cands[0] || null;
}

/* ---------- Link-Token: signiert, damit nur Käufer buchen können. ONBOARDING_SECRET in Netlify. ---------- */
export interface OnbToken { n: string; e: string; p?: string; o?: string; r?: string; x: number }
const SECRET = () => (process.env.ONBOARDING_SECRET || "").trim();
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const mac = (body: string) => createHmac("sha256", SECRET()).update(body).digest("base64url");
/** Beliebige kleine Daten signieren (z. B. .ics-Link in der Bestätigungsmail). */
export function signData(data: Record<string, unknown>): string { const body = b64(JSON.stringify(data)); return `${body}.${mac(body)}`; }
export function verifyData<T>(tok: string): T | null {
  if (!SECRET()) return null;
  const [body, sig] = String(tok || "").split("."); if (!body || !sig) return null;
  const exp = Buffer.from(mac(body)), got = Buffer.from(sig);
  if (exp.length !== got.length || !timingSafeEqual(exp, got)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()) as T; } catch { return null; }
}
export function signToken(t: Omit<OnbToken, "x">, days = 60): string {
  const body = b64(JSON.stringify({ ...t, x: Math.floor(Date.now() / 1000) + days * 86400 }));
  return `${body}.${mac(body)}`;
}
export function verifyToken(tok: string): OnbToken | null {
  if (!SECRET()) return null;
  const [body, sig] = String(tok || "").split("."); if (!body || !sig) return null;
  const exp = Buffer.from(mac(body)), got = Buffer.from(sig);
  if (exp.length !== got.length || !timingSafeEqual(exp, got)) return null;
  try { const t = JSON.parse(Buffer.from(body, "base64url").toString()) as OnbToken; return t.e && t.x * 1000 > Date.now() ? t : null; } catch { return null; }
}
