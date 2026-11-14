/* Onboarding mit echten Kalendern: Daten aus Google laden und den Buchungslink für Mails bauen. Logik in ./onboarding.ts. */
import { listEvents, gcalConfigured } from "./gcal";
import { CALENDARS, signToken, type CalData } from "./onboarding";
import { SITE } from "./util";

export async function loadCalData(from: Date, to: Date): Promise<CalData> {
  const all = (ids: string[]) => Promise.all(ids.map(id => listEvents(id, from, to))).then(r => r.flat());
  const [service, classes, absences, appointments] = await Promise.all([listEvents(CALENDARS.service, from, to), listEvents(CALENDARS.classes, from, to), all(CALENDARS.absences), all(CALENDARS.appointments)]);
  return { service, classes, absences, appointments };
}

/** Persönlicher Link zur Terminwahl. Leer, solange Google-Zugang oder ONBOARDING_SECRET fehlen; die Mails fallen dann auf WhatsApp zurück. */
export function onboardingLink(c: { name: string; email: string; phone?: string; offer?: string; ref?: string }): string {
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim() || !c.email) return "";
  return `${SITE}/onboarding?t=${signToken({ n: c.name.trim(), e: c.email.trim().toLowerCase(), p: c.phone || undefined, o: c.offer || undefined, r: c.ref || undefined })}`;
}
