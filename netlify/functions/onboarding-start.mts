/* POST /api/onboarding/start {firstname, lastname, email, phone, vertrag?} → Buchungszugang für die offene Onboarding-Seite /onboarding
   (für Mitglieder ohne persönlichen Link, z. B. aus der Magicline-Mail). Selbst ausgestellt (s=1): 2 Stunden gültig, keine Auskunft über
   bestehende Termine, Teammail sagt "Mitgliedschaft prüfen". Bremse 6 je Anschluss und Stunde. {available:false} ohne Google-Zugang. */
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
  const first = cleanName(b.firstname), last = cleanName(b.lastname), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 40), vertrag = clean(b.vertrag, 20).replace(/[^\dA-Za-z-]/g, "");
  if (!first || !last) return json({ error: "Bitte Vor- und Nachnamen eintragen (nur Buchstaben).", field: "name" }, 400);
  if (!validEmail(email)) return json({ error: "Bitte eine gültige E-Mail-Adresse eintragen.", field: "email" }, 400);
  if (phone.replace(/\D/g, "").length < 6) return json({ error: "Bitte eine Handynummer mit mindestens 6 Ziffern eintragen.", field: "phone" }, 400);
  const ok = await allowHit("onbstart/" + clientKey(req), 6, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Anfragen. Schreib uns bitte kurz per WhatsApp." }, 429);
  const t = signToken({ n: `${first} ${last}`, e: email, p: phone, o: vertrag ? `Vertrag ${vertrag} (offene Seite, bitte prüfen)` : "Vertrag nicht angegeben (offene Seite, Mitgliedschaft bitte prüfen)", r: "offen", k: "onboarding", s: 1 }, 2 / 24);
  return json({ available: true, t });
};
export const config: Config = { path: "/api/onboarding/start" };
