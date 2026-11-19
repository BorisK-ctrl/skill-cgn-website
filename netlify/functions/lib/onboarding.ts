/*
 * Termine mit Coach (Boris, 14.11. und 18.11.2026): Onboarding 90 Minuten nach dem Abschluss, Probetraining 30 Minuten.
 * Reine Logik ohne Netzwerk, damit sie gegen echte Kalenderdaten testbar ist (scripts/test-onboarding-slots.mjs). Google-Zugriff in ./gcal.ts,
 * Laden der Kalender in ./onboarding-live.ts. Freie Zeiten werden bei jedem Aufruf frisch berechnet: gelöschte Kurse geben die Zeit sofort frei.
 *
 * Ein Coach aus STAFF ist für einen Termin frei, wenn
 * - im Kalender SERVICE eine Schicht von ihm den ganzen Termin abdeckt (Titel nur sein Name, ggf. mit "Service"/"Schicht"),
 * - er in der Zeit keinen eigenen Kurs gibt (Kalender "SKILL Classes" und "Classes "),
 * - er nicht abwesend ist (ganztägige SERVICE-Einträge, SERVICE-Einträge mit seinem Namen, die keine reine Schicht sind, Urlaub, Urlaub Coaches),
 * - er keinen anderen Termin hat (Onboarding, Probetraining, Personal Training, Erstgespräch, Six Week onboarding, Kalender info@,
 *   sein eigener Kalender über Frei/Gebucht).
 * Grundsatz: lieber eine freie Zeit zu wenig anbieten als eine belegte. Was nicht eindeutig zuzuordnen ist, blockiert:
 * - Termin ohne sicheren Coach (kein Gast, keine Markierung, keine Zeile "Coach:") belegt zusätzlich einen der freien Coaches.
 *   Angeboten wird nur, wenn danach noch ein Coach frei ist; die Teammail markiert solche Buchungen (uncertain).
 * - Abwesenheit oder ganztägiger SERVICE-Eintrag ohne erkennbaren Namen: alle Coaches belegt.
 * - Eigener Kalender eines Coaches nicht lesbar: dieser Coach ist nicht buchbar.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { berlinToDate, berlinDate, addDays } from "./util";

/** emailHashes: SHA-256 (erste 16 Hex-Zeichen) der Kalender-Adressen, an denen der Coach als Gast erkannt wird. Keine Klartext-Adressen im
 *  öffentlichen Repo. Neue Adresse: node -e "console.log(require('crypto').createHash('sha256').update('mail@x.de'.toLowerCase()).digest('hex').slice(0,16))" */
export interface Staff { key: string; name: string; full: string; emailHashes: string[] }
/** Wer Onboardings und Probetrainings macht. Reihenfolge = Vorrang bei Gleichstand. */
export const STAFF: Staff[] = [
  { key: "peter", name: "Peter", full: "Peter Schaale", emailHashes: ["495c63ec5c7e0756"] },
  { key: "nic", name: "Nic", full: "Nic Müller", emailHashes: ["66e9984ae16f00d6"] },
  { key: "noah", name: "Noah", full: "Noah Wengenroth", emailHashes: ["dc315579d057bd9f"] },
  { key: "boris", name: "Boris", full: "Boris Kurowski", emailHashes: ["496e2b527f0e0ada", "5bbc9ca8e2e77f13"] },
];
/** Andere Coaches und Service-Kräfte (machen keine Onboardings). Ihre Kurse, Schichten und Abwesenheiten belegen niemanden aus STAFF.
 *  Ein Kurs mit einem Namen, der hier fehlt, belegt vorsichtshalber einen freien Coach. Neue Kolleginnen und Kollegen hier ergänzen. */
export const OTHERS = ["Antonia", "Toni", "Mario", "Saidu", "Fabian", "Catharina", "Paul", "Silvana", "Tommy", "Leon", "Sina", "Nathalie", "Sanja", "Denise"];

export const CALENDARS = {
  service: "c_03da334cdae727c1bbc66f80fdf15ba4b89ff4373699a4a49604d654a7fb5b53@group.calendar.google.com",
  /* "SKILL Classes" (aus Magicline, Zeile "Coach:") und "Classes " (Kursplan von Hand, Titel "HYROX Noah"). Beide, weil sie voneinander abweichen. */
  classes: ["c_7cc0ae41a2adbe7729eb7e814141aa9506940dea0351dae300a6caa33cb1a916@group.calendar.google.com", "c_a1bb5580b8a05bf5ce6c96d5177ff0ab586604d45063e344a96a731c500a44e7@group.calendar.google.com"],
  onboarding: "c_9251c5d9f2fdb7bf2dd82c0e8614a83f5271de3f3df7ce73417c8c572892e9bd@group.calendar.google.com",
  probetraining: "c_e279c7fea8188faef6b25641272f630312cde07f505ffcabfb4f1bc3117a4d15@group.calendar.google.com",
  /* Urlaub, Urlaub Coaches */
  absences: ["c_5ebef3d12c85fb6383f61f5b1da9f4ff17ced0381db9a6884aca28d8aa237329@group.calendar.google.com", "c_7f486f3269c0fafd67cb6ba6f016b105dbbefbf914005dcc33db5f3820c83540@group.calendar.google.com"],
  /* Onboarding, Probetraining, Personal Training, Erstgespräch, Six Week onboarding, info@ (dort landen die Buchungen der Google-Terminseite) */
  appointments: ["c_9251c5d9f2fdb7bf2dd82c0e8614a83f5271de3f3df7ce73417c8c572892e9bd@group.calendar.google.com", "c_e279c7fea8188faef6b25641272f630312cde07f505ffcabfb4f1bc3117a4d15@group.calendar.google.com",
    "c_f9556f6198dac5de06bc51d128a672ee696e468524829e67f2838f4f0b3bcb4a@group.calendar.google.com", "c_a9779d468a029e3f51ee3f46f4d199b4540f92eb4056cdd8cbca56747ae6cb89@group.calendar.google.com",
    "c_fdeef1e9e7a842a331724120ca2c94b407e98294f721e42ca127ea6c3be7a152@group.calendar.google.com", "info@skill-studios.com"],
};
/** Eigene Kalender der Coaches, nur Frei/Gebucht (Google freeBusy): was dort beschäftigt ist, blockt den Coach. */
export const PERSONAL: Record<string, string[]> = { boris: ["boris.k@skill-studios.com"] };

export const STEP_MIN = 30, HORIZON_DAYS = 21;
/** Terminarten: Dauer, Vorlauf, Zielkalender, Markierung der Website-Einträge. */
export const KINDS = {
  onboarding: { label: "Onboarding", calendar: CALENDARS.onboarding, durationMin: 90, leadHours: 12, source: "website-onboarding" },
  probetraining: { label: "Probetraining", calendar: CALENDARS.probetraining, durationMin: 30, leadHours: 3, source: "website-probetraining" },
} as const;
export type Kind = keyof typeof KINDS;
export const SOURCES: string[] = Object.values(KINDS).map(k => k.source);

/** Google-Kalender-Termin, so wie events.list ihn liefert (nur die Felder, die hier zählen). calendarId setzt der Lader. */
export interface GAttendee { email?: string; responseStatus?: string; self?: boolean }
export interface GEvent { id?: string; created?: string; status?: string; summary?: string; description?: string; eventType?: string; calendarId?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; attendees?: GAttendee[]; extendedProperties?: { private?: Record<string, string> } }
/** Frei/Gebucht eines eigenen Kalenders: belegte Zeiten, oder error wenn Google ihn nicht liefern konnte (dann gilt der Coach als belegt). */
export interface PersonalBusy { busy: { start: string; end: string }[]; error?: string }
export interface CalData { service: GEvent[]; classes: GEvent[]; absences: GEvent[]; appointments: GEvent[]; personal?: Record<string, PersonalBusy> }
interface Span { s: number; e: number }
interface Unclear extends Span { title: string }
export interface OnbSlot { start: string; end: string; staff: string[]; uncertain: boolean }
export interface Note { kind: "alle" | "unklar" | "abwesend" | "ignoriert"; why: string; start: string; title: string }

const DAY = 86400000;
const allDay = (ev: GEvent) => !ev.start?.dateTime && !!ev.start?.date;
function span(ev: GEvent): Span | null {
  if (ev.start?.dateTime && ev.end?.dateTime) { const s = Date.parse(ev.start.dateTime), e = Date.parse(ev.end.dateTime); return s && e && e > s ? { s, e } : null; }
  if (ev.start?.date) { const s = berlinToDate(ev.start.date, "00:00").getTime(), e = berlinToDate(ev.end?.date || addDays(ev.start.date, 1), "00:00").getTime(); return e > s ? { s, e } : null; }
  return null;
}
const rx = (n: string) => new RegExp(`(^|[^\\p{L}])${n}([^\\p{L}]|$)`, "iu");
const STAFF_RX = STAFF.map(s => ({ key: s.key, rx: rx(s.name) }));
const OTHER_RX = OTHERS.map(rx);
const namesIn = (t: string) => STAFF_RX.filter(x => x.rx.test(t)).map(x => x.key);
const otherIn = (t: string) => OTHER_RX.some(r => r.test(t));
/** Zeile "Coach: Vorname Nachname" (Kurse aus Magicline). Nur bis zum Zeilenende. */
const coachLine = (ev: GEvent) => (ev.description || "").match(/^[ \t]*Coach:[ \t]*(\S[^\n]*)$/im)?.[1].trim() || "";
const declined = (a: GAttendee) => a.responseStatus === "declined";
/** Der Kalender selbst hat abgesagt (z. B. info@ bei einem Jour Fix anderer): kein Termin dieses Kalenders. */
const selfDeclined = (ev: GEvent) => (ev.attendees || []).some(a => (a.self || (!!ev.calendarId && (a.email || "").toLowerCase() === ev.calendarId.toLowerCase())) && declined(a));
export const emailHash = (email: string) => createHash("sha256").update((email || "").trim().toLowerCase()).digest("hex").slice(0, 16);
/** Sichere Zuordnung: Website-Markierung, eingeladene Coaches (nicht abgesagt), Zeile "Coach:". */
function strongStaff(ev: GEvent): string[] {
  const out = new Set<string>();
  const own = ev.extendedProperties?.private?.staff; if (own && STAFF.some(s => s.key === own)) out.add(own);
  const guests = (ev.attendees || []).filter(a => !declined(a) && a.email).map(a => emailHash(a.email!));
  for (const s of STAFF) if (s.emailHashes.some(h => guests.includes(h))) out.add(s.key);
  for (const k of namesIn(coachLine(ev))) out.add(k);
  return [...out];
}
/** Mitarbeiter eines Termins: Vereinigung aller Hinweise (Markierung, Gäste, Zeile "Coach:", Titel). Lieber einer zu viel belegt als einer zu wenig. */
export function staffOf(ev: GEvent): string[] { return [...new Set([...strongStaff(ev), ...namesIn(ev.summary || "")])]; }

/* SERVICE: reine Schicht = Titel nur Name, optional "Service"/"Schicht" ("Peter", "Noah", "Nic Service"), höchstens 14 Stunden */
const SHIFT_RX = new RegExp(`^(${STAFF.map(s => s.name).join("|")})(\\s+(service|schicht|dienst|frühschicht|spätschicht|früh|spät))?[.!]?$`, "iu");
const APPOINTMENT_WORD = /(^|[^\p{L}])(pt|personal|probetraining|probe|onboarding|ersttermin|erstgespräch|check ?up|termin|einweisung)([^\p{L}]|$)/iu;

const overlaps = (a: Span, b: Span) => a.s < b.e && a.e > b.s;
function merge(list: Span[]): Span[] {
  const out: Span[] = [];
  for (const x of [...list].sort((a, b) => a.s - b.s)) { const last = out[out.length - 1]; if (last && x.s <= last.e) last.e = Math.max(last.e, x.e); else out.push({ ...x }); }
  return out;
}

interface Model { shifts: Record<string, Span[]>; busy: Record<string, Span[]>; blocked: Set<string>; generic: Unclear[]; load: Record<string, Record<string, number>>; notes: Note[] }
/** Kalenderdaten in Schichten, Belegungen und unklare Blocker übersetzen. */
export function buildModel(d: CalData): Model {
  const shifts: Record<string, Span[]> = {}, busy: Record<string, Span[]> = {}, load: Record<string, Record<string, number>> = {};
  const generic: Unclear[] = [], all: Span[] = [], notes: Note[] = [], blocked = new Set<string>();
  const unclear = (ev: GEvent, sp: Span, why: string) => { generic.push({ ...sp, title: (ev.summary || "(ohne Titel)").slice(0, 80) }); note("unklar", why, ev, sp); };
  for (const s of STAFF) { shifts[s.key] = []; busy[s.key] = []; load[s.key] = {}; }
  const note = (kind: Note["kind"], why: string, ev: GEvent, sp: Span) => notes.push({ kind, why, start: new Date(sp.s).toISOString(), title: (ev.summary || "(ohne Titel)").slice(0, 80) });
  const usable = (ev: GEvent) => ev.status !== "cancelled" && ev.eventType !== "workingLocation" && !selfDeclined(ev);

  for (const ev of d.service) {
    const sp = span(ev); if (!sp || !usable(ev)) continue;
    const title = (ev.summary || "").trim(), ks = namesIn(title);
    if (!allDay(ev) && ks.length === 1 && SHIFT_RX.test(title) && sp.e - sp.s <= 14 * 3600000) { shifts[ks[0]].push(sp); continue; }
    if (ks.length) { for (const k of ks) busy[k].push(sp); if (!allDay(ev)) note("abwesend", "SERVICE-Eintrag ist keine reine Schicht", ev, sp); continue; }
    if (otherIn(title)) continue; // Schicht oder Abwesenheit einer anderen Kraft (Sanja, Silvana, Denise …)
    all.push(sp); note("alle", "SERVICE-Eintrag ohne erkennbaren Namen", ev, sp);
  }
  for (const ev of d.absences) {
    const sp = span(ev); if (!sp || !usable(ev)) continue;
    const ks = staffOf(ev);
    if (ks.length) { for (const k of ks) busy[k].push(sp); continue; }
    if (otherIn(ev.summary || "")) continue;
    all.push(sp); note("alle", "Abwesenheit ohne erkennbaren Namen", ev, sp);
  }
  for (const ev of d.classes) {
    const sp = span(ev); if (!sp || !usable(ev)) continue;
    const ks = staffOf(ev);
    if (ks.length) { for (const k of ks) busy[k].push(sp); continue; }
    const title = ev.summary || "";
    if (!APPOINTMENT_WORD.test(title) && (otherIn(title) || otherIn(coachLine(ev)))) continue; // Kurs eines anderen Coaches
    unclear(ev, sp, "Kurs ohne erkennbaren Coach");
  }
  for (const ev of d.appointments) {
    const sp = span(ev); if (!sp || !usable(ev)) continue;
    const strong = strongStaff(ev), ks = staffOf(ev);
    for (const k of ks) { busy[k].push(sp); const day = berlinDate(new Date(sp.s)); load[k][day] = (load[k][day] || 0) + 1; }
    /* Nur der Titel nennt einen Coach (z. B. Kundenname "Peter" in der Google-Terminseite): zusätzlich als unklar zählen */
    if (!strong.length) unclear(ev, sp, ks.length ? "Coach nur im Titel" : "Termin ohne erkennbaren Coach");
  }
  for (const s of STAFF) {
    const p = d.personal?.[s.key]; if (!p) continue;
    if (p.error) { blocked.add(s.key); continue; }
    for (const b of p.busy) { const sp = { s: Date.parse(b.start), e: Date.parse(b.end) }; if (sp.s && sp.e > sp.s) busy[s.key].push(sp); }
  }
  /* Personal-Kalender angefragt, aber nicht geliefert (Lader setzt dann personal[key] = {busy:[], error}) */
  for (const k in PERSONAL) if (d.personal && !d.personal[k]) blocked.add(k);
  for (const k in busy) busy[k].push(...all);
  for (const k in shifts) shifts[k] = merge(shifts[k]);
  return { shifts, busy, blocked, generic, load, notes };
}

/** Buchbare Starts im Zeitraum. Je Start die freien Coaches, sortiert nach Vorrang (wenigste Termine am Tag, dann Reihenfolge in STAFF). */
export function computeSlots(d: CalData, o: { from: Date; to: Date; now?: Date; durationMin: number; leadHours: number; stepMin?: number }): OnbSlot[] {
  const m = buildModel(d);
  const step = (o.stepMin ?? STEP_MIN) * 60000;
  const dur = Math.ceil(o.durationMin / (o.stepMin ?? STEP_MIN)) * step; // Dauer immer ein Vielfaches des Rasters
  const now = (o.now ?? new Date()).getTime();
  const earliest = Math.max(o.from.getTime(), now + o.leadHours * 3600000), latest = Math.min(o.to.getTime(), now + (HORIZON_DAYS + 1) * DAY);
  const starts = new Set<number>();
  for (const k in m.shifts) for (const sh of m.shifts[k]) for (let t = Math.ceil(sh.s / step) * step; t + dur <= sh.e; t += step) if (t >= earliest && t + dur <= latest) starts.add(t);
  const out: OnbSlot[] = [];
  for (const t of [...starts].sort((a, b) => a - b)) {
    const slot = { s: t, e: t + dur }, day = berlinDate(new Date(t));
    const free = STAFF.filter(st => !m.blocked.has(st.key) && m.shifts[st.key].some(sh => sh.s <= slot.s && sh.e >= slot.e) && !m.busy[st.key].some(b => overlaps(b, slot)))
      .sort((a, b) => (m.load[a.key][day] || 0) - (m.load[b.key][day] || 0)).map(st => st.key);
    const unknown = m.generic.filter(g => overlaps(g, slot)).length;
    if (free.length > unknown) out.push({ start: new Date(slot.s).toISOString(), end: new Date(slot.e).toISOString(), staff: free, uncertain: unknown > 0 });
  }
  return out;
}
/** Coach für einen Start: der erste freie (computeSlots sortiert schon nach Vorrang). */
export function pickStaff(slot: OnbSlot): Staff | null { return STAFF.find(s => s.key === slot.staff[0]) || null; }
/** Unklare Termine, die einen Zeitraum berühren (für die Teammail: "bitte prüfen, wer den macht"). */
export function unclearAt(d: CalData, start: string, end: string): string[] {
  const sp = { s: Date.parse(start), e: Date.parse(end) };
  return buildModel(d).generic.filter(g => overlaps(g, sp)).map(g => g.title);
}

/* ---------- Link-Token: verschlüsselt (AES-256-GCM, Schlüssel aus ONBOARDING_SECRET). In der URL stehen keine Kundendaten. ---------- */
export interface OnbToken { n: string; e: string; p?: string; o?: string; r?: string; k?: Kind; x: number }
const SECRET = () => (process.env.ONBOARDING_SECRET || "").trim();
const key = () => createHash("sha256").update("skill-onboarding-token:" + SECRET()).digest();
export function signToken(t: Omit<OnbToken, "x">, days = 60): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify({ ...t, x: Math.floor(Date.now() / 1000) + days * 86400 }), "utf8"), c.final()]);
  return "v2." + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}
export function verifyToken(tok: string): OnbToken | null {
  if (!SECRET() || typeof tok !== "string" || !tok.startsWith("v2.")) return null;
  const raw = Buffer.from(tok.slice(3), "base64url"); if (raw.length < 29) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28));
    const t = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as OnbToken;
    return typeof t.e === "string" && t.e && typeof t.n === "string" && t.x * 1000 > Date.now() ? t : null;
  } catch { return null; }
}
/* Kleine Daten signieren (keine Kundendaten), z. B. den .ics-Link in der Bestätigung */
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const mac = (body: string) => createHmac("sha256", SECRET()).update(body).digest("base64url");
export function signData(data: Record<string, unknown>): string { const body = b64(JSON.stringify(data)); return `${body}.${mac(body)}`; }
export function verifyData<T>(tok: string): T | null {
  if (!SECRET()) return null;
  const [body, sig] = String(tok || "").split("."); if (!body || !sig) return null;
  const exp = Buffer.from(mac(body)), got = Buffer.from(sig);
  if (exp.length !== got.length || !timingSafeEqual(exp, got)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()) as T; } catch { return null; }
}
