/* POST /api/onboarding/book {t, start} → Termin eintragen (Terminart aus dem Token: Onboarding 90 Min im Kalender "Onboarding",
   Probetraining 30 Min im Kalender "Probetraining", auch unter /api/termin/book), Bestätigung an Kunden und Team.
   Je Kunde läuft immer nur eine Buchung (Sperre auf die E-Mail, Doppelklick und zwei Tabs). Schon gebucht: {booked}. Termin vorbei: kein neuer
   über den Link. Ist nach einer abgebrochenen Antwort schon ein Termin im Kalender, wird er übernommen statt ein zweiter angelegt.
   Verfügbarkeit, Zellensperren und Eintrag in lib/booking.ts.
   Selbst ausgestellte Zugänge (Probetraining und offene Onboarding-Seite, s=1): E-Mail nicht bestätigt. Deshalb nie Termindaten einer bestehenden
   Buchung zurückgeben, sondern {alreadyBooked} und die Bestätigung (höchstens einmal am Tag) an die hinterlegte Adresse.
   Bremse: 5 Buchungsversuche je Anschluss und Tag. */
import type { Config } from "@netlify/functions";
import { createHash } from "node:crypto";
import { json, clientKey } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { verifyToken, KINDS, STAFF, type Kind } from "./lib/onboarding";
import { bookAppointment, checkStart, currentBooking, bookedView, findWebsiteBooking, googleCalLink, icsLink } from "./lib/booking";
import { acquireLock, releaseLock, saveOnboarding, allowHit, personKey, type OnboardingRecord } from "./lib/store";
import { sendOnboardingMails, sendOnboardingCustomerMail } from "./lib/onboarding-mail";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const raw = await req.json().catch(() => null);
  const b = (raw && typeof raw === "object" ? raw : {}) as { t?: unknown; start?: unknown };
  const t = verifyToken(typeof b.t === "string" ? b.t : "");
  if (!t) return json({ error: "Der Link ist ungültig oder abgelaufen. Schreib uns kurz per WhatsApp, wir schicken dir einen neuen." }, 401);
  if (!gcalConfigured()) return json({ error: "Terminbuchung gerade nicht verfügbar." }, 503);
  const kind: Kind = t.k === "probetraining" ? "probetraining" : "onboarding";
  const label = KINDS[kind].label;
  const open = kind === "probetraining" || t.s === 1; // selbst ausgestellt
  /* Jeder Versuch zählt (auch mit ungültiger Zeit), sonst ließe sich die Bremse mit Fehlversuchen austesten */
  if (open && !(await allowHit(`${kind}book/` + clientKey(req), 5, 86400000).catch(() => true))) return json({ error: "Zu viele Buchungsversuche. Schreib uns bitte kurz per WhatsApp." }, 429);
  const chk = checkStart(kind, b.start); if (!chk.ok) return json({ error: chk.error }, chk.status);

  /* Eine Buchung je Kunde gleichzeitig */
  const lockKey = `customer/${kind}/` + createHash("sha256").update(personKey(t.e)).digest("hex").slice(0, 32); // keine E-Mail im Schlüssel
  let owner: string | null = null;
  for (let i = 0; i < 10 && !owner; i++) { owner = await acquireLock(lockKey, 30000); if (!owner) await sleep(400); }
  if (!owner) return json({ error: "Deine Buchung läuft gerade schon. Bitte lade die Seite in ein paar Sekunden neu." }, 409);
  try {
    const cur = await currentBooking(t.e, kind);
    /* Offene Seiten: keine Termindaten an jemanden, der nur eine E-Mail eintippt. Die Bestätigung geht an die hinterlegte Adresse. */
    if (open && cur.state !== "none") return json(await alreadyBooked(cur.rec, cur.state === "past", kind), 409);
    if (cur.state === "booked") return json({ error: `Du hast schon einen ${label}-Termin.`, booked: bookedView(cur.rec) }, 409);
    if (cur.state === "past") return json({ error: `Dein ${label} war schon. Für einen neuen Termin schreib uns kurz per WhatsApp.`, past: { start: cur.rec.start, end: cur.rec.end } }, 409);

    const base = { email: t.e, name: t.n, phone: t.p, offer: t.o, ref: t.r, kind, calendarId: KINDS[kind].calendar, bookedAt: new Date().toISOString(), mails: { customer: false, staff: false } };
    /* Schon eingetragen (Antwort ging verloren)? Dann übernehmen statt doppelt buchen. */
    const orphan = await findWebsiteBooking(kind, t.e).catch(e => { console.log(`${kind}-book suche`, String(e)); return null; });
    if (orphan) {
      const rec: OnboardingRecord = { ...base, start: orphan.start, end: orphan.end, staff: orphan.staff || "", eventId: orphan.id };
      await saveOnboarding(rec);
      if (open) return json(await alreadyBooked(rec, false, kind), 409);
      return json({ error: `Du hast schon einen ${label}-Termin.`, booked: bookedView(rec) }, 409);
    }

    const r = await bookAppointment(kind, { name: t.n, email: t.e, phone: t.p, offer: t.o, ref: t.r }, new Date(chk.startMs).toISOString());
    if (!r.ok) return json({ error: r.error }, r.status);
    const rec: OnboardingRecord = { ...base, start: r.start, end: r.end, staff: r.staff.key, eventId: r.eventId, uncertain: r.uncertain.length ? r.uncertain : undefined };
    await saveOnboarding(rec); // sofort, damit ein zweiter Klick den Termin sieht
    const google = googleCalLink(kind, r.start, r.end), ics = icsLink(kind, r.start, r.end);
    rec.mails = await sendOnboardingMails({ kind, name: t.n, email: t.e, phone: t.p, offer: t.o, start: r.start, end: r.end, coach: r.staff.name, coachFull: r.staff.full, google, ics,
      minutes: KINDS[kind].durationMin, uncertain: r.uncertain }).catch(e => { console.log(`${kind} mail`, String(e)); return { customer: false, staff: false }; });
    await saveOnboarding(rec).catch(e => console.log(`${kind}-book save mails`, String(e)));
    console.log(`${kind}-book ${r.start} ${r.staff.key}${r.uncertain.length ? " (bitte prüfen)" : ""} mail=${JSON.stringify(rec.mails)}`);
    return json({ ok: true, start: r.start, end: r.end, coach: r.staff.name, google, ics });
  } finally { await releaseLock(lockKey, owner); }
};
/** Termin schon vorhanden (offene Seiten): neutrale Antwort, Bestätigung erneut an die gespeicherte Adresse (höchstens einmal je 24 Stunden). */
async function alreadyBooked(rec: OnboardingRecord, past: boolean, kind: Kind) {
  const label = KINDS[kind].label, art = kind === "probetraining" ? "ein Probetraining" : "ein Onboarding";
  if (past) return { alreadyBooked: true, error: `Für diese E-Mail gab es schon ${art}. Für einen weiteren Termin schreib uns kurz per WhatsApp.` };
  let resent = false;
  if (!rec.resentAt || Date.now() - Date.parse(rec.resentAt) > 86400000) {
    const coach = STAFF.find(s => s.key === rec.staff);
    resent = await sendOnboardingCustomerMail({ kind, name: rec.name, email: rec.email, start: rec.start, end: rec.end, coach: coach?.name || "deinem Coach", coachFull: coach?.full || "",
      google: googleCalLink(kind, rec.start, rec.end), ics: icsLink(kind, rec.start, rec.end), minutes: KINDS[kind].durationMin });
    if (resent) { rec.resentAt = new Date().toISOString(); await saveOnboarding(rec).catch(() => {}); }
  }
  return { alreadyBooked: true, error: `Für diese E-Mail ist schon ${art} eingetragen. ${resent ? "Wir haben dir die Bestätigung gerade noch einmal geschickt." : "Die Details stehen in deiner Bestätigungsmail."} Verschieben geht per WhatsApp.`, label };
}
export const config: Config = { path: ["/api/onboarding/book", "/api/termin/book"] };
