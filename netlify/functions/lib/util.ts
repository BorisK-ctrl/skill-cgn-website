/* Gemeinsame Helfer für die Buchungs-Functions. */
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
