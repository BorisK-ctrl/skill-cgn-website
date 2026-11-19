/* Google Kalender REST ohne SDK: Dienstkonto (JWT RS256) → Zugriffstoken → events.list / get / insert / delete und freeBusy.
   Netlify-Umgebung (docs/onboarding-setup.md):
   - GOOGLE_SA_EMAIL (…@….iam.gserviceaccount.com) und GOOGLE_SA_KEY (privater Schlüssel aus der JSON-Datei, \n als Zeilenumbruch erlaubt)
   - GOOGLE_SA_SUBJECT (empfohlen, z. B. info@skill-studios.com): Dienstkonto handelt im Namen dieses Workspace-Kontos (domainweite Delegation).
     Dann muss kein Kalender einzeln mit dem Dienstkonto geteilt werden. Ohne SUBJECT: jeden Kalender mit dem Dienstkonto teilen.
   Jede Anfrage hat ein Zeitlimit und wird bei 401 (Token neu), 429, 5xx und Ratenlimit kurz wiederholt. */
import { createSign, randomBytes } from "node:crypto";

const SA_EMAIL = () => (process.env.GOOGLE_SA_EMAIL || "").trim();
const SA_KEY = () => (process.env.GOOGLE_SA_KEY || "").replace(/\\n/g, "\n").trim();
const SA_SUBJECT = () => (process.env.GOOGLE_SA_SUBJECT || "").trim();
export const gcalConfigured = () => !!SA_EMAIL() && SA_KEY().includes("PRIVATE KEY");

const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";
const TIMEOUT_MS = 6000;
const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let cached: { token: string; exp: number } | null = null;
let pending: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: SA_EMAIL(), scope: SCOPES, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600, ...(SA_SUBJECT() ? { sub: SA_SUBJECT() } : {}) }));
  const sig = b64url(createSign("RSA-SHA256").update(`${head}.${claim}`).sign(SA_KEY()));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(TIMEOUT_MS),
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${claim}.${sig}` });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google Anmeldung fehlgeschlagen (${r.status} ${j.error || ""} ${j.error_description || ""})`.trim());
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return cached.token;
}
/** Ein Token für alle gleichzeitigen Aufrufe (nicht neun Anmeldungen beim Kaltstart). */
function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60000) return Promise.resolve(cached.token);
  return (pending ||= fetchToken().finally(() => { pending = null; }));
}

export class GoogleError extends Error { constructor(msg: string, public status: number, public reason = "") { super(msg); } }

async function call(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    let r: Response;
    try {
      r = await fetch("https://www.googleapis.com/calendar/v3" + path, { method, signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (attempt < 1 && method === "GET") { await sleep(300); continue; } // Zeitlimit oder Netz: Lesen einmal wiederholen
      throw new GoogleError(`Google Kalender ${method} ${path.split("?")[0]}: ${String((e as Error)?.message || e)}`, 0, "network");
    }
    if (method === "DELETE" && (r.status === 204 || r.status === 200 || r.status === 410)) return {};
    const text = await r.text();
    let j: any = null; try { j = text ? JSON.parse(text) : {}; } catch { j = null; }
    if (r.ok) { if (j === null) throw new GoogleError(`Google Kalender ${method}: Antwort nicht lesbar`, r.status, "parse"); return j; }
    const reason = j?.error?.errors?.[0]?.reason || j?.error?.status || "";
    if (r.status === 401 && attempt < 1) { cached = null; continue; }
    const retry = r.status === 429 || r.status >= 500 || (r.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(reason));
    if (retry && attempt < 2) { await sleep(250 + Math.random() * 550); continue; }
    throw new GoogleError(`Google Kalender ${method} ${path.split("?")[0]}: ${r.status} ${j?.error?.message || ""}`.trim(), r.status, reason);
  }
}

const FIELDS = "nextPageToken,items(id,status,created,summary,description,eventType,start,end,attendees(email,responseStatus,self),extendedProperties)";
/** Termine im Zeitraum, Serien aufgelöst (singleEvents). Abgesagte Termine fallen weg. Jeder Termin bekommt calendarId. */
export async function listEvents(calendarId: string, from: Date, to: Date, extra: Record<string, string> = {}): Promise<any[]> {
  const out: any[] = []; let page = "";
  do {
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", maxResults: "2500", fields: FIELDS, ...extra, ...(page ? { pageToken: page } : {}) });
    const j = await call("GET", `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    if (!Array.isArray(j.items)) throw new GoogleError(`Google Kalender ${calendarId.slice(0, 12)}…: keine Terminliste`, 200, "parse");
    for (const e of j.items) if (e.status !== "cancelled") out.push({ ...e, calendarId });
    page = j.nextPageToken || "";
  } while (page);
  return out;
}
/** Ein Termin oder null, wenn er gelöscht oder abgesagt ist. */
export async function getEvent(calendarId: string, eventId: string): Promise<any | null> {
  try { const e = await call("GET", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`); return e?.status === "cancelled" ? null : e; }
  catch (e) { if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) return null; throw e; }
}
/** Belegte Zeiten eigener Kalender (freeBusy). Abgesagte und als "verfügbar" markierte Termine zählen bei Google nicht. */
export async function freeBusy(ids: string[], from: Date, to: Date): Promise<Record<string, { busy: { start: string; end: string }[]; error?: string }>> {
  if (!ids.length) return {};
  const j = await call("POST", "/freeBusy", { timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: "Europe/Berlin", items: ids.map(id => ({ id })) });
  const out: Record<string, { busy: { start: string; end: string }[]; error?: string }> = {};
  for (const id of ids) {
    const c = j.calendars?.[id];
    out[id] = !c ? { busy: [], error: "fehlt" } : c.errors?.length ? { busy: [], error: c.errors.map((x: any) => x.reason).join(",") } : { busy: Array.isArray(c.busy) ? c.busy : [] };
  }
  return out;
}
/** Termin anlegen. Eigene Termin-ID (Hex ist gültiges base32hex): eine Wiederholung nach Zeitlimit legt keinen zweiten an, sondern liefert den ersten. */
export async function insertEvent(calendarId: string, event: Record<string, unknown>): Promise<any> {
  const id = String(event.id || randomBytes(16).toString("hex"));
  try { return await call("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, { ...event, id }); }
  catch (e) {
    if (e instanceof GoogleError && (e.status === 409 || e.status === 0 || e.status >= 500)) { const ev = await getEvent(calendarId, id).catch(() => null); if (ev) return ev; }
    throw e;
  }
}
export async function deleteEvent(calendarId: string, eventId: string) {
  for (let i = 0; ; i++) {
    try { return await call("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`); }
    catch (e) { if (e instanceof GoogleError && e.status === 404) return {}; if (i >= 2) throw e; await sleep(400 * (i + 1)); }
  }
}
