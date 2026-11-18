/* Termine mit echten Kalendern: Daten bei jedem Aufruf frisch aus Google laden (kein Zwischenspeicher, gelöschte Kurse sind sofort frei)
   und den persönlichen Buchungslink für Mails bauen. Logik in ./onboarding.ts. Fällt ein Kalender aus, wirft loadCalData:
   lieber keine Zeiten anzeigen als Zeiten, die mit einem nicht gelesenen Kalender kollidieren. */
import { listEvents, freeBusy, gcalConfigured } from "./gcal";
import { CALENDARS, PERSONAL, signToken, type CalData, type PersonalBusy } from "./onboarding";
import { SITE } from "./util";

export async function loadCalData(from: Date, to: Date): Promise<CalData> {
  const all = (ids: string[]) => Promise.all(ids.map(id => listEvents(id, from, to))).then(r => r.flat());
  const personalIds = Object.values(PERSONAL).flat();
  const [service, classes, absences, appointments, fb] = await Promise.all([
    listEvents(CALENDARS.service, from, to), all(CALENDARS.classes), all(CALENDARS.absences), all(CALENDARS.appointments),
    freeBusy(personalIds, from, to).catch(e => { console.log("freeBusy", String(e)); return {} as Record<string, PersonalBusy>; }),
  ]);
  /* Eigene Kalender je Coach zusammenführen; nicht lesbar = error (der Coach ist dann nicht buchbar) */
  const personal: Record<string, PersonalBusy> = {};
  for (const [staff, ids] of Object.entries(PERSONAL)) {
    const parts = ids.map(id => fb[id] || { busy: [], error: "nicht geladen" });
    const err = parts.find(p => p.error)?.error;
    personal[staff] = err ? { busy: [], error: err } : { busy: parts.flatMap(p => p.busy) };
    if (err) console.log(`freeBusy ${staff}: ${err} (Coach gilt als belegt)`);
  }
  return { service, classes, absences, appointments, personal };
}

/** Persönlicher Link zur Terminwahl. Leer, solange Google-Zugang oder ONBOARDING_SECRET fehlen; die Mails fallen dann auf WhatsApp zurück. */
export function onboardingLink(c: { name: string; email: string; phone?: string; offer?: string; ref?: string }): string {
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim() || !c.email) return "";
  return `${SITE}/onboarding?t=${signToken({ n: c.name.trim(), e: c.email.trim().toLowerCase(), p: c.phone || undefined, o: c.offer || undefined, r: c.ref || undefined, k: "onboarding" })}`;
}
