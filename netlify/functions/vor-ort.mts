/* Vor-Ort-Abschluss (/vor-ort, iPad am Tresen): Team-Zugang und Suche nach Interessenten in Magicline, etwa nach dem Probetraining.
   Am Tresen tippt der Kunde dann nur noch, was Magicline noch nicht hat (meist Geburtsdatum und Adresse), die IBAN und unterschreibt.
   GET  /api/vor-ort/status → {ready, search, session}: Team-Passwort eingerichtet, Magicline-Schlüssel da, dieses Gerät angemeldet
   POST /api/vor-ort/login {password} → Cookie vo (14 Stunden) · POST /api/vor-ort/logout → Cookie weg
   POST /api/vor-ort/suche {q} → {hits, more}: höchstens 10, Interessenten zuerst, neueste zuerst, Kontaktdaten gekürzt (nur mit Sitzung)
   POST /api/vor-ort/kunde {id} → {kunde}: Name, E-Mail, Handy, Geburtsdatum, Adresse, uuid für den Vertrag (nur mit Sitzung, nicht für Mitglieder)
   Bremse: Anmeldung 10 Versuche je Anschluss und Stunde, gezählt vor der Prüfung, Speicher gestört: 503. Suche 200 je Anschluss und Stunde.
   Magicline Open API mit MAGICLINE_OPEN_API_KEY, Recht CUSTOMER_READ (lib/magicline.ts). Keine Personendaten in Logs, alles no-store. */
import type { Config } from "@netlify/functions";
import { json, clientKey } from "./lib/util";
import { allowHit } from "./lib/store";
import { magiclineConfigured, searchCustomers, getCustomer, MagiclineError, type MlCustomer } from "./lib/magicline";
import { configured, passwordOk, sessionCookie, clearCookie, hasSession, criteriaFor, rankHits, toPrefill } from "./lib/vor-ort";

const HOUR = 3600000;
/* Nur der Status ins Log, nie die Antwort von Magicline (sie kann Kundendaten enthalten) */
function magiclineFailed(e: unknown) {
  const status = e instanceof MagiclineError ? e.status : -1;
  console.log("vor-ort Magicline", status);
  if (status === 401 || status === 403) return json({ error: "Magicline erlaubt die Suche nicht. Der Schlüssel braucht das Recht CUSTOMER_READ." }, 503);
  if (status === 404) return json({ error: "In Magicline nicht gefunden." }, 404);
  return json({ error: "Magicline antwortet gerade nicht. Bitte gleich noch einmal." }, 502);
}

export default async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  if (path === "/api/vor-ort/status") {
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    return json({ ready: configured(), search: configured() && magiclineConfigured(), session: hasSession(req) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  /* Nur JSON von unserer eigenen Seite: fremde Seiten scheitern am CORS-Vorabcheck, das Cookie ist SameSite=Strict */
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) return json({ error: "Ungültige Anfrage" }, 415);
  if ((req.headers.get("sec-fetch-site") || "").toLowerCase() === "cross-site") return json({ error: "Ungültige Anfrage" }, 403);
  if (path === "/api/vor-ort/logout") return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  if (!configured()) return json({ error: "Die Suche ist noch nicht eingerichtet (Team-Passwort fehlt)." }, 503);

  if (path === "/api/vor-ort/login") {
    const allowed = await allowHit("vorort/" + clientKey(req), 10, HOUR).catch(() => null);
    if (allowed === null) return json({ error: "Gerade nicht erreichbar. Bitte in ein paar Minuten noch einmal." }, 503);
    if (!allowed) return json({ error: "Zu viele Versuche, in einer Stunde wieder." }, 429);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!passwordOk(b.password)) return json({ error: "Passwort stimmt nicht." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie() });
  }

  if (path !== "/api/vor-ort/suche" && path !== "/api/vor-ort/kunde") return json({ error: "Nicht gefunden" }, 404);
  if (!hasSession(req)) return json({ error: "Bitte Team-Passwort eingeben.", login: true }, 401);
  if (!magiclineConfigured()) return json({ error: "Die Suche ist noch nicht eingerichtet (Magicline-Schlüssel fehlt)." }, 503);
  if (!(await allowHit("vorortsuche/" + clientKey(req), 200, HOUR).catch(() => true))) return json({ error: "Zu viele Suchen. Bitte kurz warten." }, 429);
  const raw = await req.json().catch(() => null);
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  if (path === "/api/vor-ort/suche") {
    const crit = criteriaFor(String(b.q ?? ""));
    if (!crit) return json({ error: "Mindestens 3 Buchstaben, eine E-Mail oder eine Handynummer." }, 400);
    /* Mehrere Schreibweisen parallel. Scheitert eine (etwa eine Telefonform, die Magicline ablehnt), zählen die anderen. */
    const res = await Promise.allSettled(crit.map(c => searchCustomers(c)));
    const ok = res.filter((r): r is PromiseFulfilledResult<MlCustomer[]> => r.status === "fulfilled");
    if (!ok.length) return magiclineFailed((res[0] as PromiseRejectedResult).reason);
    return json(rankHits(ok.flatMap(r => r.value)));
  }

  const id = Number(b.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "Ungültige Anfrage" }, 400);
  let c: MlCustomer;
  try { c = await getCustomer(id); } catch (e) { return magiclineFailed(e); }
  if (c?.status === "MEMBER") return json({ error: "Schon Mitglied mit Vertrag. Bitte in Magicline prüfen." }, 409);
  return json({ kunde: toPrefill(c) });
};

export const config: Config = { path: ["/api/vor-ort/status", "/api/vor-ort/login", "/api/vor-ort/logout", "/api/vor-ort/suche", "/api/vor-ort/kunde"] };
