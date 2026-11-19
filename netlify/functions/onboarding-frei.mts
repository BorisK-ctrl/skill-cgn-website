/* GET /api/onboarding/frei → freie Onboarding-Zeiten (90 Min) der nächsten drei Wochen für die offene Seite /onboarding und als Rückfall der
   Dankeseite. Mit Google-Zugang: {available:true, byDay} live aus den Kalendern (höchstens 15 s alt, Bremse 600 je Anschluss und Stunde).
   Ohne Google-Zugang oder wenn Google nicht antwortet: {available:false, anfrage:true, byDay} = Wunschtermine (lib/anfrage.ts), die Seite
   zeigt denselben Kalender und schickt eine Anfrage, das Team bestätigt per Mail. */
import type { Config } from "@netlify/functions";
import { json, clientKey } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { KINDS } from "./lib/onboarding";
import { cachedFreeByDay } from "./lib/booking";
import { allowHit } from "./lib/store";
import { anfrageByDay, ANFRAGE_MIN } from "./lib/anfrage";

const anfrage = () => json({ available: false, anfrage: true, durationMin: ANFRAGE_MIN, byDay: anfrageByDay() });

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return anfrage();
  const ok = await allowHit("onbslots/" + clientKey(req), 600, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Abrufe. Bitte in ein paar Minuten noch einmal." }, 429);
  try { return json({ available: true, durationMin: KINDS.onboarding.durationMin, byDay: await cachedFreeByDay("onboarding") }); }
  catch (e) { console.log("onboarding-frei: Google nicht erreichbar, Wunschtermine", String(e)); return anfrage(); }
};
export const config: Config = { path: "/api/onboarding/frei" };
