/* GET /api/cancel?id=&t= → Buchung stornieren (Link aus der Bestätigungsmail). Antwortet mit einer kleinen HTML-Seite. */
import type { Config } from "@netlify/functions";
import { html, fmtDate, berlinTime, SITE } from "./lib/util";
import { getBooking, saveBooking, getTicket, saveTicket } from "./lib/store";
import { cancelBooking, magiclineConfigured } from "./lib/magicline";
import { sendCancelMail } from "./lib/notify";

const page = (title: string, text: string) => html(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — SKILL CGN</title><style>body{margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}main{max-width:520px}h1{font-size:32px;text-transform:uppercase;margin:0 0 12px}p{color:#bbb;line-height:1.5}a{display:inline-block;margin-top:20px;background:#FBFF00;color:#000;font-weight:900;text-transform:uppercase;letter-spacing:.1em;font-size:13px;padding:14px 22px;text-decoration:none}</style></head><body><main><p style="color:#FBFF00;font-size:12px;letter-spacing:2px;text-transform:uppercase">SKILL CGN</p><h1>${title}</h1><p>${text}</p><a href="${SITE}/kursplan">Zum Kursplan</a></main></body></html>`);

export default async (req: Request) => {
  const u = new URL(req.url); const id = u.searchParams.get("id") || ""; const t = u.searchParams.get("t") || "";
  const b = await getBooking(id);
  if (!b || b.token !== t) return page("Link ungültig", "Diese Buchung wurde nicht gefunden. Schreib uns per WhatsApp, wir helfen dir.");
  const when = `${fmtDate(new Date(b.start))}, ${berlinTime(new Date(b.start))} Uhr`;
  if (b.status === "cancelled") return page("Schon storniert", `${b.slotName} am ${when} ist bereits storniert.`);
  if (new Date(b.start).getTime() - Date.now() < 4 * 3600000) return page("Zu kurzfristig", `${b.slotName} am ${when} kann online nur bis 4 Stunden vor Beginn storniert werden. Ruf uns an oder schreib per WhatsApp.`);
  if (b.magiclineBookingId && magiclineConfigured()) { try { await cancelBooking(b.magiclineBookingId); } catch (e: any) { b.note = (b.note ? b.note + " · " : "") + "Storno in Magicline fehlgeschlagen: " + String(e?.message || e).slice(0, 120); } }
  if (b.ticketCreditUsed) { const tk = await getTicket(b.email); if (tk) { tk.credits += 1; tk.updatedAt = new Date().toISOString(); await saveTicket(tk); } }
  b.status = "cancelled"; b.cancelledAt = new Date().toISOString(); await saveBooking(b);
  await sendCancelMail(b).catch(() => {});
  return page("Storniert", `${b.slotName} am ${when} ist storniert.${b.ticketCreditUsed ? " Dein Kurs-Guthaben wurde wieder gutgeschrieben." : ""} Bis zum nächsten Mal.`);
};
export const config: Config = { path: "/api/cancel" };
