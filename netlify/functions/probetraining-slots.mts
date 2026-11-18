/* GET /api/probetraining/slots → freie Probetraining-Zeiten (30 Min) der nächsten drei Wochen, ohne Anmeldung: /probetraining zeigt den Kalender
   zuerst, die Daten kommen nach der Zeitwahl. {available:false} ohne Google-Zugang (die Seite zeigt dann das Formular mit Google-Terminseite).
   Live aus Google, höchstens 15 s alt (Zwischenspeicher je Instanz gegen Dauerabfragen). Die Buchung rechnet immer frisch (lib/booking.ts).
   Bremse: 120 Abrufe je IP und Stunde (die offene Seite lädt einmal pro Minute nach). Mitarbeiter werden nicht verraten. */
import type { Config } from "@netlify/functions";
import { createHash } from "node:crypto";
import { json } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { KINDS } from "./lib/onboarding";
import { freeByDay } from "./lib/booking";
import { allowHit } from "./lib/store";

type ByDay = Record<string, { start: string; end: string }[]>;
const FRESH_MS = 15000;
let cache: { at: number; byDay: ByDay } | null = null;
let inflight: Promise<ByDay> | null = null;

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return json({ available: false });
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unbekannt";
  const ok = await allowHit("probeslots/" + createHash("sha256").update(ip).digest("hex").slice(0, 24), 120, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Abrufe. Bitte in ein paar Minuten noch einmal." }, 429);
  try {
    if (!cache || Date.now() - cache.at > FRESH_MS) {
      inflight ||= freeByDay("probetraining").finally(() => { inflight = null; });
      cache = { at: Date.now(), byDay: await inflight };
    }
    return json({ available: true, durationMin: KINDS.probetraining.durationMin, byDay: cache.byDay });
  } catch (e) {
    console.log("probetraining-slots", String(e));
    return json({ error: "Kalender gerade nicht erreichbar." }, 502);
  }
};
export const config: Config = { path: "/api/probetraining/slots" };
