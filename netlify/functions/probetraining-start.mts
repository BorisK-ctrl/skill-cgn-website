/* POST /api/probetraining/start {firstname, lastname, email, phone, plz, usc} → Token für die Terminwahl Probetraining (30 Min) auf /probetraining.
   {available:false}, solange Google-Zugang oder ONBOARDING_SECRET fehlen: die Seite leitet dann wie bisher zur Google-Terminseite.
   Bremse: höchstens 6 Anfragen je IP und Stunde. Je E-Mail gibt es ohnehin nur einen Probetraining-Termin (lib/booking.ts currentBooking). */
import type { Config } from "@netlify/functions";
import { createHash } from "node:crypto";
import { json, validEmail } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { signToken } from "./lib/onboarding";
import { allowHit } from "./lib/store";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return json({ available: false });
  const raw = await req.json().catch(() => null);
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const first = clean(b.firstname, 60), last = clean(b.lastname, 60), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 40), plz = clean(b.plz, 5), usc = b.usc === "ja" ? "ja" : "nein";
  if (!first || !last || !validEmail(email) || phone.replace(/\D/g, "").length < 6 || !/^\d{5}$/.test(plz)) return json({ error: "Bitte alle Felder ausfüllen." }, 400);
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unbekannt";
  const ok = await allowHit("probe/" + createHash("sha256").update(ip).digest("hex").slice(0, 24), 6, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Anfragen. Schreib uns bitte kurz per WhatsApp." }, 429);
  const t = signToken({ n: `${first} ${last}`, e: email, p: phone, o: `PLZ ${plz} · Urban Sports Club: ${usc}`, r: "probetraining", k: "probetraining" }, 14);
  return json({ available: true, t });
};
export const config: Config = { path: "/api/probetraining/start" };
