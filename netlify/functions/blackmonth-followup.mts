/* Black Month Nachfass, täglich 09:00 Berlin (08:00 UTC im Winter).
   Mail 2: drei Tage nach Kauf ohne Starttermin im Google Kalender. Mail 3: am Tag vor dem Termin.
   Termine kommen aus dem Kalender über die geheime iCal-Adresse (BLACKMONTH_CALENDAR_ICS, Google Kalender → Einstellungen → "Privatadresse im iCal-Format").
   Kalender "Probetraining", Termine heißen "Starttermin NAME", Telefonnummer steht in der Beschreibung.
   Ein Termin gehört zum Käufer, wenn seine Telefonnummer (Ziffern verglichen) oder E-Mail im Text steht oder sein voller Name im Titel oder Text vorkommt.
   Ohne BLACKMONTH_CALENDAR_ICS wird kein Termin erkannt, also geht Mail 2 nach drei Tagen an alle ohne Termin und Mail 3 nie.
   Zeitplan-Funktion, nicht per HTTP erreichbar. Von Hand: netlify functions:invoke blackmonth-followup. */
import type { Config } from "@netlify/functions";
import { listBlackMonth, saveBlackMonth } from "./lib/store";
import type { BlackMonthRecord } from "./lib/store";
import { sendBlackMonthNudge, sendBlackMonthReminder, mailConfigured } from "./lib/notify";
import { berlinDate, addDays, json } from "./lib/util";

const NUDGE_AFTER_DAYS = 3;
const LAST_START = "2026-12-15";

interface CalEvent { start: string; summary: string; text: string }
/** Minimaler ICS-Leser: VEVENT mit DTSTART (UTC, lokal mit TZID oder reines Datum), SUMMARY, DESCRIPTION, ATTENDEE. Zeilenfortsetzungen werden aufgelöst. */
export function parseIcs(ics: string): CalEvent[] {
  const lines = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: CalEvent[] = []; let cur: Record<string, string> | null = null;
  for (const raw of lines) {
    if (raw === "BEGIN:VEVENT") { cur = {}; continue; }
    if (raw === "END:VEVENT") { if (cur?.DTSTART) out.push({ start: icsDate(cur.DTSTART, cur.DTSTART_TZID), summary: unesc(cur.SUMMARY || ""), text: unesc([cur.DESCRIPTION || "", cur.ATTENDEES || "", cur.ORGANIZER || ""].join("\n")) }); cur = null; continue; }
    if (!cur) continue;
    const i = raw.indexOf(":"); if (i < 0) continue;
    const [keyPart, value] = [raw.slice(0, i), raw.slice(i + 1)]; const [key, ...params] = keyPart.split(";");
    if (key === "DTSTART") { cur.DTSTART = value; const tz = params.find(p => p.startsWith("TZID=")); if (tz) cur.DTSTART_TZID = tz.slice(5); }
    else if (key === "ATTENDEE") cur.ATTENDEES = (cur.ATTENDEES || "") + "\n" + value + " " + params.join(" ");
    else if (key === "SUMMARY" || key === "DESCRIPTION" || key === "ORGANIZER") cur[key] = value;
  }
  return out;
}
const unesc = (v: string) => v.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
/** ICS-Zeit nach ISO. Reines Datum → 09:00 Berlin, lokale Zeit mit TZID Europe/* → als Berliner Zeit gelesen. */
function icsDate(v: string, tzid?: string): string {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return "";
  const [, y, mo, d, h = "09", mi = "00", s = "00", z] = m;
  if (z) return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  /* lokale Zeit in der Zone: Wanduhrzeit der Zone zum geratenen UTC-Zeitpunkt bestimmen, Differenz ist der Zonen-Offset */
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tzid || "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (wall - guess)).toISOString();
}
const digits = (p: string) => { let d = p.replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "49" + d.slice(1); return d; };
/** Termin des Käufers: Telefonnummer, E-Mail (Teilnehmer oder Text) oder voller Name, frühester künftiger oder heutiger Termin. */
export function findAppointment(r: BlackMonthRecord, events: CalEvent[], todayBerlin: string): string | null {
  const email = r.email.toLowerCase(); const name = r.name.trim().toLowerCase(); const phone = digits(r.phone || "");
  const hits = events.filter(e => {
    const t = (e.summary + "\n" + e.text).toLowerCase();
    if (email && t.includes(email)) return true;
    if (name.length > 3 && t.includes(name)) return true;
    /* Telefonnummern im Text: Ziffernfolgen mit Trennzeichen, normalisiert vergleichen */
    if (phone.length >= 9) for (const m of t.match(/[+\d][\d\s\/().-]{7,}\d/g) || []) if (digits(m) === phone) return true;
    return false;
  })
    .filter(e => e.start && berlinDate(new Date(e.start)) >= todayBerlin).sort((a, b) => a.start.localeCompare(b.start));
  return hits[0]?.start || null;
}

export async function runFollowup() {
  const today = berlinDate(new Date()); const tomorrow = addDays(today, 1);
  let events: CalEvent[] = []; let calendar = "aus";
  const ics = (process.env.BLACKMONTH_CALENDAR_ICS || "").trim();
  if (ics) { try { const r = await fetch(ics); events = r.ok ? parseIcs(await r.text()) : []; calendar = r.ok ? `${events.length} Termine` : `Fehler ${r.status}`; } catch (e) { calendar = "Fehler " + String(e).slice(0, 80); } }
  let nudges = 0, reminders = 0, checked = 0;
  for (const r of await listBlackMonth()) {
    if (!r.email) continue; checked++;
    const appt = ics ? findAppointment(r, events, today) : r.appointmentAt || null;
    if (appt !== (r.appointmentAt || null)) { r.appointmentAt = appt; await saveBlackMonth(r); }
    if (!mailConfigured()) continue;
    const ageDays = Math.floor((Date.now() - new Date(r.at).getTime()) / 86400000);
    if (!appt && !r.mails.nudge && ageDays >= NUDGE_AFTER_DAYS && today <= LAST_START) {
      if (await sendBlackMonthNudge(r)) { r.mails.nudge = new Date().toISOString(); await saveBlackMonth(r); nudges++; }
    }
    if (appt && !r.mails.reminder && berlinDate(new Date(appt)) === tomorrow) {
      if (await sendBlackMonthReminder({ ...r, appointmentAt: appt })) { r.mails.reminder = new Date().toISOString(); await saveBlackMonth(r); reminders++; }
    }
  }
  const result = { today, calendar, checked, nudges, reminders };
  console.log(`blackmonth-followup ${JSON.stringify(result)}`);
  return result;
}

export default async () => json(await runFollowup());
export const config: Config = { schedule: "0 8 * * *" };
