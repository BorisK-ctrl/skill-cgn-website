/* Vor-Ort-Abschluss (iPad am Tresen): Team-Sitzung und Suche nach Interessenten in Magicline (Boris 26.11.2026).
   Wer zum Probetraining da war, steht schon als Interessent in Magicline. Das Team sucht ihn, die Daten gehen ins Formular, und der Vertrag
   hängt am selben Kunden (uuid = identityToken), statt einen zweiten anzulegen.
   Zugang: Team-Passwort VOR_ORT_PASSWORD (Netlify, mindestens 12 Zeichen). Sitzung als HMAC-Cookie "vo", 14 Stunden, nur für /api/vor-ort.
   Der Schlüssel des Cookies ist aus dem Passwort abgeleitet: ein neues Passwort meldet alle iPads ab. Keine Personendaten in Logs. */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { MlCustomer } from "./magicline";

export const COOKIE = "vo";
const HOURS = 14;
const pw = () => process.env.VOR_ORT_PASSWORD || "";
export const configured = () => pw().length >= 12;
const key = () => createHash("sha256").update("vor-ort-sitzung|" + pw()).digest();
const sign = (exp: number) => createHmac("sha256", key()).update(`vo|${exp}`).digest("hex");
/* Vergleich in konstanter Zeit: beide Seiten erst hashen, dann gleich lange Puffer vergleichen */
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
export const passwordOk = (v: unknown) => configured() && typeof v === "string" && v.length <= 200 && same(v, pw());
const cookieAttrs = "Path=/api/vor-ort; HttpOnly; Secure; SameSite=Strict";
export function sessionCookie(now = Date.now()) {
  const exp = Math.floor(now / 1000) + HOURS * 3600;
  return `${COOKIE}=${exp}.${sign(exp)}; Max-Age=${HOURS * 3600}; ${cookieAttrs}`;
}
export const clearCookie = () => `${COOKIE}=; Max-Age=0; ${cookieAttrs}`;
export function hasSession(req: Request, now = Date.now()): boolean {
  if (!configured()) return false;
  const raw = (req.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
  const m = /^(\d{9,11})\.([0-9a-f]{64})$/.exec(raw);
  if (!m) return false;
  const exp = Number(m[1]) * 1000;
  if (exp <= now || exp > now + (HOURS * 3600 + 60) * 1000) return false;
  return timingSafeEqual(Buffer.from(m[2], "hex"), Buffer.from(sign(Number(m[1])), "hex"));
}

/* ---------- Suchbegriff → Magicline-Kriterien ---------- */
export type Criteria = { firstName?: string; lastName?: string; email?: string; phoneNumber?: string };
const clean = (v: string, max: number) => v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
/** E-Mail als ganzer Wert, Handy in den üblichen Schreibweisen (0176…, +49176…), Namen ab dem Anfang, Vor- und Nachname in beiden
 *  Reihenfolgen (das Team tippt mal "Markus Hövel", mal "Hövel Markus"). Höchstens drei Anfragen an Magicline. null = zu ungenau. */
export function criteriaFor(q: string): Criteria[] | null {
  const s = clean(q, 80);
  if (s.includes("@")) return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s) ? [{ email: s.toLowerCase() }] : null;
  const compact = s.replace(/[\s()/.-]/g, "");
  if (/^(\+|00)?\d+$/.test(compact)) {
    const d = compact.replace(/^00/, "+");
    if (d.replace(/\D/g, "").length < 6 || d.length > 16) return null;
    const national = d.startsWith("+49") ? "0" + d.slice(3) : d.startsWith("0") ? d : "";
    const intl = national ? "+49" + national.slice(1) : d;
    return [...new Set([s, national, intl].filter(Boolean))].slice(0, 3).map(phoneNumber => ({ phoneNumber }));
  }
  const words = s.split(" ").filter(w => /^[\p{L}\p{M}'-]+$/u.test(w));
  if (!words.length || words.join("").replace(/['-]/g, "").length < 3) return null;
  if (words.length === 1) return [{ lastName: words[0] }, { firstName: words[0] }];
  const head = words[0], tail = words.slice(1).join(" "), last = words[words.length - 1], init = words.slice(0, -1).join(" ");
  const out: Criteria[] = [{ firstName: head, lastName: tail }, { firstName: last, lastName: init }];
  if (words.length > 2) out.push({ firstName: init, lastName: last });
  return out;
}

/* ---------- Treffer für die Liste: nur was das Team zum Erkennen braucht ---------- */
export interface Hit { id: number; name: string; ort: string; seit: string; email: string; tel: string; mitglied: boolean; geburtsdatum: boolean; adresse: boolean }
const phoneOf = (c: MlCustomer) => (c.phonePrivateMobile || c.phonePrivate || c.phoneBusinessMobile || c.phoneBusiness || "").trim();
const maskEmail = (e: string) => { const [u, d] = e.trim().split("@"); return u && d ? `${u.slice(0, 2)}…@${d}` : ""; };
const isoDate = (v?: string) => (v || "").slice(0, 10);
const deDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";
const createdDay = (c: MlCustomer) => { const t = Date.parse(c.createdDateTime || ""); return Number.isFinite(t) ? new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : ""; };
const hasAddress = (c: MlCustomer) => !!(c.street?.trim() && c.houseNumber?.trim() && /^\d{5}$/.test((c.zipCode || "").trim()) && c.city?.trim());
export function toHit(c: MlCustomer): Hit {
  const tel = phoneOf(c).replace(/\D/g, "");
  return { id: c.id, name: clean(`${c.firstName || ""} ${c.lastName || ""}`, 80) || "Ohne Namen", ort: clean(c.city || c.zipCode || "", 60), seit: deDate(createdDay(c)),
    email: maskEmail(c.email || ""), tel: tel ? "…" + tel.slice(-3) : "", mitglied: c.status === "MEMBER", geburtsdatum: /^\d{4}-\d{2}-\d{2}$/.test(isoDate(c.dateOfBirth)), adresse: hasAddress(c) };
}
/** Treffer aus mehreren Anfragen: jeder Kunde einmal, Interessenten und frühere Mitglieder zuerst, darin die neuesten zuerst. */
export function rankHits(found: MlCustomer[], max = 10): { hits: Hit[]; more: boolean } {
  const byId = new Map<number, MlCustomer>(); for (const c of found) if (!byId.has(c.id)) byId.set(c.id, c);
  const all = [...byId.values()].sort((a, b) => Number(a.status === "MEMBER") - Number(b.status === "MEMBER") || (Date.parse(b.createdDateTime || "") || 0) - (Date.parse(a.createdDateTime || "") || 0));
  return { hits: all.slice(0, max).map(toHit), more: all.length > max };
}

/* ---------- Daten für das Formular, erst beim Antippen ---------- */
export interface Prefill { uuid: string; customerNumber: string; firstName: string; lastName: string; email: string; phone: string; birthDate: string; street: string; streetNumber: string; zipCode: string; city: string }
export function toPrefill(c: MlCustomer): Prefill {
  const dob = isoDate(c.dateOfBirth), zip = (c.zipCode || "").trim();
  return { uuid: /^[0-9a-f-]{32,36}$/i.test(c.uuid || "") ? c.uuid! : "", customerNumber: clean(c.customerNumber || "", 30),
    firstName: clean(c.firstName || "", 40), lastName: clean(c.lastName || "", 40), email: clean(c.email || "", 120), phone: clean(phoneOf(c), 40),
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : "", street: clean(c.street || "", 80), streetNumber: clean(c.houseNumber || "", 10),
    zipCode: /^\d{5}$/.test(zip) ? zip : "", city: clean(c.city || "", 60) };
}
