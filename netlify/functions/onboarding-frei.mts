/* GET /api/onboarding/frei → freie Onboarding-Zeiten (90 Min) der nächsten drei Wochen für die offene Seite /onboarding (ohne persönlichen Link,
   z. B. aus der Magicline-Mail "Neues Mitglied"). {available:false} ohne Google-Zugang. Höchstens 15 s alt, Bremse 600 je Anschluss und Stunde. */
import type { Config } from "@netlify/functions";
import { json, clientKey } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { KINDS } from "./lib/onboarding";
import { cachedFreeByDay } from "./lib/booking";
import { allowHit } from "./lib/store";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return json({ available: false });
  const ok = await allowHit("onbslots/" + clientKey(req), 600, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Abrufe. Bitte in ein paar Minuten noch einmal." }, 429);
  try { return json({ available: true, durationMin: KINDS.onboarding.durationMin, byDay: await cachedFreeByDay("onboarding") }); }
  catch (e) { console.log("onboarding-frei", String(e)); return json({ error: "Kalender gerade nicht erreichbar." }, 502); }
};
export const config: Config = { path: "/api/onboarding/frei" };
