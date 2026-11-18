/* GET /api/onboarding/slots?t=<Token> → freie Onboarding-Starts (90 Min) der nächsten drei Wochen, je Tag. Immer live aus Google berechnet,
   kein Zwischenspeicher: gelöschte Kurse sind beim nächsten Laden frei. Mitarbeiter werden nicht verraten.
   Hat der Kunde schon gebucht: {booked} (mit dem Kalender abgeglichen), Termin vorbei: {past}. */
import type { Config } from "@netlify/functions";
import { json } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { verifyToken, KINDS } from "./lib/onboarding";
import { freeByDay, currentBooking, bookedView } from "./lib/booking";

export default async (req: Request) => {
  const t = verifyToken(new URL(req.url).searchParams.get("t") || "");
  if (!t) return json({ error: "Der Link ist ungültig oder abgelaufen. Schreib uns kurz per WhatsApp, wir schicken dir einen neuen." }, 401);
  if (!gcalConfigured()) return json({ error: "Terminbuchung gerade nicht verfügbar." }, 503);
  const firstName = t.n.split(/\s+/)[0] || "";
  try {
    const cur = await currentBooking(t.e);
    if (cur.state === "booked") return json({ firstName, booked: bookedView(cur.rec) });
    if (cur.state === "past") return json({ firstName, past: { start: cur.rec.start, end: cur.rec.end } });
    return json({ firstName, durationMin: KINDS.onboarding.durationMin, byDay: await freeByDay("onboarding") });
  } catch (e) {
    console.log("onboarding-slots", String(e));
    return json({ error: "Kalender gerade nicht erreichbar. Bitte in ein paar Minuten noch einmal versuchen." }, 502);
  }
};
export const config: Config = { path: "/api/onboarding/slots" };
