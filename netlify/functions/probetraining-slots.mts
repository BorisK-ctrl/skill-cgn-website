/* GET /api/probetraining/slots → freie Probetraining-Zeiten (30 Min) der nächsten drei Wochen, ohne Anmeldung: /probetraining zeigt den Kalender
   zuerst, die Daten kommen nach der Zeitwahl. Live aus Google, höchstens 15 s alt (lib/booking.ts cachedFreeByDay). Die Buchung rechnet immer frisch.
   Ohne Google-Zugang oder wenn Google nicht antwortet: {available:false, anfrage:true, byDay} = Wunschtermine (lib/anfrage.ts), derselbe Kalender,
   das Team bestätigt per Mail (Boris, 19.11.2026: Kalender statt Formular mit Weiterleitung).
   Bremse: 600 Abrufe je Anschluss und Stunde (IPv6 je /64). Mitarbeiter werden nicht verraten. */
import type { Config } from "@netlify/functions";
import { json, clientKey } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { KINDS } from "./lib/onboarding";
import { cachedFreeByDay } from "./lib/booking";
import { allowHit } from "./lib/store";
import { anfrageByDay, anfrageMinutes } from "./lib/anfrage";

const anfrage = () => json({ available: false, anfrage: true, durationMin: anfrageMinutes("probetraining"), byDay: anfrageByDay(new Date(), "probetraining") });

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return anfrage();
  const ok = await allowHit("probeslots/" + clientKey(req), 600, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Abrufe. Bitte in ein paar Minuten noch einmal." }, 429);
  try { return json({ available: true, durationMin: KINDS.probetraining.durationMin, byDay: await cachedFreeByDay("probetraining") }); }
  catch (e) { console.log("probetraining-slots: Google nicht erreichbar, Wunschtermine", String(e)); return anfrage(); }
};
export const config: Config = { path: "/api/probetraining/slots" };
