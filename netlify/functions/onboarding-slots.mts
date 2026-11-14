/* GET /api/onboarding/slots?t=<Link-Token> → freie Onboarding-Starts der nächsten drei Wochen, je Tag. Mitarbeiter werden nicht verraten. */
import type { Config } from "@netlify/functions";
import { json, berlinDate } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { computeSlots, verifyToken, HORIZON_DAYS, DURATION_MIN } from "./lib/onboarding";
import { loadCalData } from "./lib/onboarding-live";
import { getOnboarding } from "./lib/store";

export default async (req: Request) => {
  const t = verifyToken(new URL(req.url).searchParams.get("t") || "");
  if (!t) return json({ error: "Der Link ist ungültig oder abgelaufen. Schreib uns kurz per WhatsApp, wir schicken dir einen neuen." }, 401);
  const first = t.n.split(/\s+/)[0] || "";
  const existing = await getOnboarding(t.e);
  if (existing && Date.parse(existing.start) > Date.now()) return json({ firstName: first, booked: { start: existing.start, end: existing.end } });
  if (!gcalConfigured()) return json({ error: "Terminbuchung gerade nicht verfügbar." }, 503);
  const from = new Date(), to = new Date(Date.now() + HORIZON_DAYS * 86400000);
  try {
    const slots = computeSlots(await loadCalData(from, to), { from, to });
    const byDay: Record<string, { start: string; end: string }[]> = {};
    for (const s of slots) (byDay[berlinDate(new Date(s.start))] ||= []).push({ start: s.start, end: s.end });
    return json({ firstName: first, durationMin: DURATION_MIN, byDay });
  } catch (e) {
    console.log("onboarding-slots", String(e));
    return json({ error: "Kalender gerade nicht erreichbar. Bitte in ein paar Minuten noch einmal versuchen." }, 502);
  }
};
export const config: Config = { path: "/api/onboarding/slots" };
