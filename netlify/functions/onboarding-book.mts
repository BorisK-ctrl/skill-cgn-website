/* POST /api/onboarding/book {t, start} → Onboarding-Termin im Kalender "Onboarding" anlegen, Bestätigung an Kunden und Team.
   Kurz vor dem Eintragen wird die Verfügbarkeit frisch berechnet. Danach Gegenprobe: Hat derselbe Mitarbeiter gleichzeitig einen zweiten
   Website-Termin bekommen (zwei Buchungen in derselben Sekunde), wird der jüngere wieder gelöscht und der Kunde wählt neu. */
import type { Config } from "@netlify/functions";
import { json, berlinDate, berlinToDate, addDays } from "./lib/util";
import { gcalConfigured, insertEvent, deleteEvent, listEvents } from "./lib/gcal";
import { computeSlots, pickStaff, verifyToken, CALENDARS, DURATION_MIN } from "./lib/onboarding";
import { loadCalData } from "./lib/onboarding-live";
import { getOnboarding, saveOnboarding, getBlackMonth, saveBlackMonth } from "./lib/store";
import { sendOnboardingMails } from "./lib/notify";

const SOURCE = "website-onboarding";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = await req.json().catch(() => ({})) as { t?: string; start?: string };
  const t = verifyToken(b.t || "");
  if (!t) return json({ error: "Der Link ist ungültig oder abgelaufen. Schreib uns kurz, wir schicken dir einen neuen." }, 401);
  if (!gcalConfigured()) return json({ error: "Terminbuchung gerade nicht verfügbar." }, 503);
  const startMs = Date.parse(b.start || ""); if (!startMs) return json({ error: "Bitte einen Termin wählen." }, 400);
  const existing = await getOnboarding(t.e);
  if (existing && Date.parse(existing.start) > Date.now()) return json({ error: "Du hast schon einen Onboarding-Termin.", booked: { start: existing.start, end: existing.end } }, 409);

  const start = new Date(startMs).toISOString();
  const day = berlinDate(new Date(startMs));
  const from = berlinToDate(day, "00:00"), to = berlinToDate(addDays(day, 1), "00:00");
  let data;
  try { data = await loadCalData(from, to); } catch (e) { console.log("onboarding-book load", String(e)); return json({ error: "Kalender gerade nicht erreichbar. Bitte gleich noch einmal versuchen." }, 502); }
  const slot = computeSlots(data, { from, to }).find(s => s.start === start);
  const staff = slot && pickStaff(slot, data.appointments);
  if (!slot || !staff) return json({ error: "Dieser Termin ist gerade weggegangen. Bitte wähle einen anderen." }, 409);

  const end = new Date(startMs + DURATION_MIN * 60000).toISOString();
  const lines = [`Onboarding über skill-studios.com (Scan, Einweisung, Trainingsplan)`, `Coach: ${staff.full}`, `Kunde: ${t.n}`, `E-Mail: ${t.e}`, t.p ? `Telefon: ${t.p}` : "", t.o ? `Angebot: ${t.o}` : "", t.r ? `Referenz: ${t.r}` : ""].filter(Boolean);
  let ev: any;
  try {
    ev = await insertEvent(CALENDARS.onboarding, { summary: `${t.n} - Onboarding (${staff.name})`, description: lines.join("\n"), location: "SKILL CGN, Herzogstraße 16–20, 50667 Köln",
      start: { dateTime: start, timeZone: "Europe/Berlin" }, end: { dateTime: end, timeZone: "Europe/Berlin" }, extendedProperties: { private: { source: SOURCE, staff: staff.key, email: t.e } } });
  } catch (e) { console.log("onboarding-book insert", String(e)); return json({ error: "Termin konnte nicht eingetragen werden. Bitte gleich noch einmal versuchen." }, 502); }

  /* Gegenprobe gegen gleichzeitige Buchungen beim selben Mitarbeiter */
  try {
    const clash = (await listEvents(CALENDARS.onboarding, new Date(startMs), new Date(end)))
      .filter(e => e.extendedProperties?.private?.source === SOURCE && e.extendedProperties?.private?.staff === staff.key)
      .sort((a, c) => String(a.created).localeCompare(String(c.created)) || String(a.id).localeCompare(String(c.id)));
    if (clash.length > 1 && clash[0].id !== ev.id) { await deleteEvent(CALENDARS.onboarding, ev.id); return json({ error: "Dieser Termin ist gerade weggegangen. Bitte wähle einen anderen." }, 409); }
  } catch (e) { console.log("onboarding-book gegenprobe", String(e)); }

  const rec = { email: t.e, name: t.n, phone: t.p, offer: t.o, ref: t.r, start, end, staff: staff.key, eventId: ev.id, bookedAt: new Date().toISOString(), mails: { customer: false, staff: false } };
  rec.mails = await sendOnboardingMails({ name: t.n, email: t.e, phone: t.p, offer: t.o, start, end, staff: staff.full }).catch(e => { console.log("onboarding mail", String(e)); return { customer: false, staff: false }; });
  await saveOnboarding(rec);
  /* Black Month: Termin am Datensatz, damit Nachfass (Mail 2) entfällt und die Erinnerung (Mail 3) am Vortag kommt */
  if (t.r?.startsWith("bm:")) { const bm = await getBlackMonth(t.r.slice(3)); if (bm) { bm.appointmentAt = start; bm.appointmentSource = "website"; await saveBlackMonth(bm); } }
  console.log(`onboarding-book ${t.e} ${start} ${staff.key} mail=${JSON.stringify(rec.mails)}`);
  return json({ ok: true, start, end, coach: staff.name });
};
export const config: Config = { path: "/api/onboarding/book" };
