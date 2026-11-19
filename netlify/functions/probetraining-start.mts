/* POST /api/probetraining/start {firstname, lastname, email, phone, plz, usc} → Token für die Probetraining-Buchung (30 Min) auf /probetraining.
   {available:false}, solange Google-Zugang oder ONBOARDING_SECRET fehlen: die Seite leitet dann wie bisher zur Google-Terminseite.
   Der Token gilt 2 Stunden (wer ihn sich selbst ausstellt, soll keine Vorräte anlegen können). Namen nur mit Buchstaben, Leerzeichen,
   Bindestrich und Apostroph (sie stehen in der Bestätigungsmail). Bremse: 6 Anfragen je Anschluss und Stunde (IPv6 je /64, lib/util.ts).
   Je Person gibt es ohnehin nur einen Probetraining-Termin (lib/booking.ts currentBooking, personKey). */
import type { Config } from "@netlify/functions";
import { json, validEmail, clientKey } from "./lib/util";
import { gcalConfigured } from "./lib/gcal";
import { signToken } from "./lib/onboarding";
import { allowHit } from "./lib/store";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanName = (v: unknown) => clean(v, 80).replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return json({ available: false });
  const raw = await req.json().catch(() => null);
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const first = cleanName(b.firstname), last = cleanName(b.lastname), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 40), plz = clean(b.plz, 5), usc = b.usc === "ja" ? "ja" : "nein";
  if (!first || !last) return json({ error: "Bitte Vor- und Nachnamen eintragen (nur Buchstaben).", field: "name" }, 400);
  if (!validEmail(email)) return json({ error: "Bitte eine gültige E-Mail-Adresse eintragen.", field: "email" }, 400);
  if (phone.replace(/\D/g, "").length < 6) return json({ error: "Bitte eine Handynummer mit mindestens 6 Ziffern eintragen.", field: "phone" }, 400);
  if (!/^\d{5}$/.test(plz)) return json({ error: "Bitte eine fünfstellige Postleitzahl eintragen.", field: "plz" }, 400);
  const ok = await allowHit("probe/" + clientKey(req), 6, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Anfragen. Schreib uns bitte kurz per WhatsApp." }, 429);
  const t = signToken({ n: `${first} ${last}`, e: email, p: phone, o: `PLZ ${plz} · Urban Sports Club: ${usc}`, r: "probetraining", k: "probetraining" }, 2 / 24);
  return json({ available: true, t });
};
export const config: Config = { path: "/api/probetraining/start" };
