/* Google Kalender REST ohne SDK: Dienstkonto (JWT RS256) → Zugriffstoken → events.list / insert / delete.
   Netlify-Umgebung: GOOGLE_SA_EMAIL (…@….iam.gserviceaccount.com) und GOOGLE_SA_KEY (privater Schlüssel aus der JSON-Datei, \n als Zeilenumbruch erlaubt).
   Jeder genutzte Kalender muss in Google Kalender mit dem Dienstkonto geteilt sein (lesen; Onboarding: "Änderungen an Terminen vornehmen"). */
import { createSign } from "node:crypto";

const SA_EMAIL = (process.env.GOOGLE_SA_EMAIL || "").trim();
const SA_KEY = (process.env.GOOGLE_SA_KEY || "").replace(/\\n/g, "\n").trim();
export const gcalConfigured = () => !!SA_EMAIL && SA_KEY.includes("PRIVATE KEY");

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: SA_EMAIL, scope: "https://www.googleapis.com/auth/calendar.events", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64url(createSign("RSA-SHA256").update(`${head}.${claim}`).sign(SA_KEY));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${claim}.${sig}` });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google Anmeldung fehlgeschlagen (${r.status} ${j.error || ""})`);
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return cached.token;
}

async function call(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<any> {
  const r = await fetch("https://www.googleapis.com/calendar/v3" + path, { method, headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (method === "DELETE" && (r.status === 204 || r.status === 410)) return {};
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Kalender ${method} ${path.split("?")[0]}: ${r.status} ${j.error?.message || ""}`);
  return j;
}

/** Termine im Zeitraum, Serien aufgelöst (singleEvents). Abgesagte Termine fallen weg. */
export async function listEvents(calendarId: string, from: Date, to: Date): Promise<any[]> {
  const out: any[] = []; let page = "";
  do {
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250", ...(page ? { pageToken: page } : {}) });
    const j = await call("GET", `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    out.push(...(j.items || []).filter((e: any) => e.status !== "cancelled")); page = j.nextPageToken || "";
  } while (page);
  return out;
}
export const insertEvent = (calendarId: string, event: Record<string, unknown>) => call("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
export const deleteEvent = (calendarId: string, eventId: string) => call("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
