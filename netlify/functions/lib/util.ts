/* Gemeinsame Helfer für die Buchungs-Functions. */
import { createHash } from "node:crypto";
export const STUDIO_TZ = "Europe/Berlin";
export const STAFF_EMAIL = process.env.BOOKING_STAFF_EMAIL || "info@skill-studios.com";
export const SITE = process.env.URL || "https://skill-studios.com";

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}
export function html(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/** Datum (YYYY-MM-DD) in Berlin für einen Zeitpunkt. */
export function berlinDate(d: Date): string { return d.toLocaleDateString("sv-SE", { timeZone: STUDIO_TZ }); }
export function berlinTime(d: Date): string { return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: STUDIO_TZ }); }
/** Berliner Wandzeit (YYYY-MM-DD + HH:MM) in einen UTC-Zeitpunkt umrechnen. */
export function berlinToDate(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number); const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess - (asIfUtc - guess));
}
export function addDays(date: string, n: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function randomToken(len = 24) { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; const b = crypto.getRandomValues(new Uint8Array(len)); for (const x of b) s += a[x % a.length]; return s; }
export const fmtDate = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: STUDIO_TZ });

/* ---------- Bremsen je Besucher: IP aus Netlify (x-nf-client-connection-ip), IPv6 auf /64 gekürzt (sonst wechselt man je Anfrage die Adresse),
   IPv4 in IPv6 (::ffff:a.b.c.d) als IPv4. Ergebnis gehasht, keine IP im Speicher. ---------- */
function expandV6(ip: string): string[] {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [], t = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill = ip.includes("::") ? Array(Math.max(0, 8 - h.length - t.length)).fill("0") : [];
  return [...h, ...fill, ...t].map(x => x.toLowerCase().replace(/^0+(?=.)/, ""));
}
export function clientIp(req: Request): string {
  const raw = (req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!raw) return "unbekannt";
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i); if (mapped) return mapped[1];
  if (raw.includes(":")) return expandV6(raw).slice(0, 4).join(":") + "::/64";
  return raw;
}
export const clientKey = (req: Request) => createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 24);
