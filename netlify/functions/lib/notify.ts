/* E-Mail über Resend, falls RESEND_API_KEY gesetzt. Sonst still überspringen (Buchung gilt trotzdem). */
import { STAFF_EMAIL, SITE, fmtDate, berlinTime } from "./util";
import type { Booking } from "./types";

const FROM = process.env.BOOKING_FROM_EMAIL || "SKILL CGN <buchung@skill-studios.com>";
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

async function send(to: string, subject: string, htmlBody: string, replyTo?: string) {
  if (!mailConfigured()) return false;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to, subject, html: htmlBody, reply_to: replyTo }) });
  return r.ok;
}
const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#000;color:#fff;padding:32px"><p style="color:#FBFF00;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px">SKILL CGN</p>${inner}<p style="color:#888;font-size:12px;margin-top:32px">SKILL CGN · Herzogstraße 16–20 · 50667 Köln · <a href="${SITE}" style="color:#FBFF00">skill-studios.com</a></p></div>`;

export async function sendBookingMails(b: Booking) {
  const start = new Date(b.start); const when = `${fmtDate(start)}, ${berlinTime(start)} Uhr`;
  const cancel = `${SITE}/api/cancel?id=${b.id}&t=${b.token}`;
  const statusLine = b.status === "confirmed" ? "Dein Platz ist reserviert." : "Wir prüfen deine Buchung und melden uns kurz, falls noch etwas fehlt.";
  const customer = await send(b.email, `${b.slotName} am ${when}`, wrap(`<h1 style="font-size:28px;margin:0 0 8px">${b.slotName}</h1><p style="font-size:18px;margin:0 0 16px">${when}</p><p>Hey ${b.firstName}, ${statusLine}</p><p>Komm 10 Minuten vorher, Handtuch und Wasser gibt es bei uns.</p><p style="margin-top:24px"><a href="${cancel}" style="color:#FBFF00">Buchung stornieren</a> (bis 4 Stunden vor Kursbeginn)</p>`), STAFF_EMAIL);
  const staff = await send(STAFF_EMAIL, `Kursbuchung: ${b.slotName} ${when} · ${b.firstName} ${b.lastName}`, wrap(`<p><strong>${b.firstName} ${b.lastName}</strong><br>${b.email}<br>${b.phone}</p><p>${b.slotName}, ${when}</p><p>Status: ${b.status} · Berechtigung: ${b.entitlement}${b.magiclineBookingId ? ` · Magicline-Buchung ${b.magiclineBookingId}` : ""}${b.note ? `<br>${b.note}` : ""}</p>`));
  return { customer, staff };
}
export async function sendCancelMail(b: Booking) {
  const start = new Date(b.start); const when = `${fmtDate(start)}, ${berlinTime(start)} Uhr`;
  await send(STAFF_EMAIL, `Storno: ${b.slotName} ${when} · ${b.firstName} ${b.lastName}`, wrap(`<p>${b.firstName} ${b.lastName} (${b.email}) hat ${b.slotName} am ${when} storniert.${b.magiclineBookingId ? ` Magicline-Buchung ${b.magiclineBookingId} wurde storniert.` : ""}</p>`));
}

/* Abbrecher-Mail nach Schritt 1 ohne Vertrag. Absender info@, Link stellt die Sitzung per Token in Schritt 2 wieder her. */
import type { CheckoutLead } from "./store";
const CHECKOUT_FROM = process.env.CHECKOUT_FROM_EMAIL || "SKILL CGN <info@skill-studios.com>";
export async function sendCheckoutReminder(l: CheckoutLead) {
  if (!mailConfigured()) return false;
  const link = `${SITE}${l.path}?resume=${encodeURIComponent(l.token)}`;
  const body = wrap(`<h1 style="font-size:28px;margin:0 0 8px">Dein Start bei SKILL wartet.</h1><p>Hey ${l.firstName}, du hast mit ${l.campaign} angefangen und bist bei Schritt 2 stehen geblieben. Deine Angaben sind gesichert, du machst genau dort weiter.</p><p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#FBFF00;color:#000;font-weight:bold;padding:14px 22px;text-decoration:none">Jetzt fertig machen, 2 Minuten</a></p><p style="color:#bbb;font-size:14px">39 € alle vier Wochen, monatlich kündbar, keine Gebühr.</p><p style="color:#bbb;font-size:14px">Hakt etwas? Antworte einfach auf diese Mail oder schreib Boris per <a href="https://wa.me/4917610877603" style="color:#FBFF00">WhatsApp</a>.</p>`);
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: CHECKOUT_FROM, to: l.email, subject: "Dein Start bei SKILL wartet", html: body, reply_to: "info@skill-studios.com" }) });
  return r.ok;
}

/* Hinweis ans Team (info@) bei Stripe-Ereignissen. Ohne RESEND_API_KEY nur Protokoll. */
export async function sendStaffAlert(subject: string, lines: string[]) {
  return send(STAFF_EMAIL, subject, wrap(`<h1 style="font-size:24px;margin:0 0 12px">${subject}</h1>${lines.map(l => `<p style="margin:0 0 8px">${l}</p>`).join("")}`));
}
