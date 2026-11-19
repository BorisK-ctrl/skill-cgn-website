/* E-Mail über Resend, falls RESEND_API_KEY gesetzt. Sonst still überspringen (Buchung gilt trotzdem). */
import { STAFF_EMAIL, SITE, fmtDate, berlinTime } from "./util";
import type { Booking } from "./types";

const FROM = process.env.BOOKING_FROM_EMAIL || "SKILL CGN <buchung@skill-studios.com>";
/* Solange skill-studios.com bei Resend nicht verifiziert ist, lehnt Resend eigene Absender ab (403). Der Testabsender darf nur an die
   Konto-Adresse (info@) senden: damit kommen Team-Mails trotzdem an, Kundenmails erst nach der Domain-Verifizierung. */
const TEST_FROM = "SKILL CGN <onboarding@resend.dev>";
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

/* MAIL_DRY_RUN=1 (nur lokal): nichts senden, Mail ins Protokoll schreiben. */
const DRY = process.env.MAIL_DRY_RUN === "1";
export interface MailAttachment { filename: string; content: string } // content Base64
async function post(from: string, to: string | string[], subject: string, html: string, replyTo?: string, text?: string, attachments?: MailAttachment[]) {
  if (DRY) { console.log(`[mail dry-run] von ${from} an ${Array.isArray(to) ? to.join(", ") : to}: "${subject}"${attachments?.length ? ` [Anhänge: ${attachments.map(a => a.filename).join(", ")}]` : ""}\n${text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)}`); return { ok: true, status: 200, body: "" }; }
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html, text, reply_to: replyTo, ...(attachments?.length ? { attachments } : {}) }) });
  const body = r.ok ? "" : (await r.text().catch(() => "")).slice(0, 200);
  return { ok: r.ok, status: r.status, body };
}
/** Mail mit wählbarem Absender, optional Textfassung. Team-Mails fallen bei abgelehntem Absender auf den Testabsender (nur an info@) zurück. */
/** E-Mail fürs Protokoll kürzen: m***@example.com */
const maskMail = (e: string) => e.replace(/^(.)[^@]*@/, "$1***@");
export async function sendFrom(from: string, to: string | string[], subject: string, htmlBody: string, opts: { replyTo?: string; text?: string; attachments?: MailAttachment[]; logLabel?: string } = {}) {
  /* logLabel: im Protokoll statt Betreff und Empfänger nur eine neutrale Bezeichnung und gekürzte Adressen (keine Kundendaten im Log) */
  const logSubject = opts.logLabel || subject;
  if (!mailConfigured()) { console.log(`mail übersprungen (RESEND_API_KEY fehlt): ${logSubject}`); return false; }
  const list = Array.isArray(to) ? to : [to];
  let r = await post(from, list, subject, htmlBody, opts.replyTo, opts.text, opts.attachments);
  if (!r.ok && (r.status === 403 || r.status === 422) && list.some(t => t.toLowerCase() === STAFF_EMAIL.toLowerCase())) {
    console.log(`mail: Absender ${from} abgelehnt (${r.status} ${r.body}), Team-Mail über Testabsender`);
    r = await post(TEST_FROM, STAFF_EMAIL, subject, htmlBody, opts.replyTo, opts.text);
  }
  console.log(`mail ${r.ok ? "gesendet" : "FEHLER " + r.status + (opts.logLabel ? "" : " " + r.body)}: "${logSubject}" an ${opts.logLabel ? list.map(maskMail).join(", ") : list.join(", ")}`);
  return r.ok;
}
export const send = (to: string, subject: string, htmlBody: string, replyTo?: string) => sendFrom(FROM, to, subject, htmlBody, { replyTo });
/* Mail-Rahmen in der SKILL CI: Logo (PNG aus /public/img, Gmail zeigt kein SVG), Schwarz, Gelb #FBFF00, Grau #2A3133, keine runden Ecken.
   Schriften: Bebas Neue (Überschriften), Space Grotesk (Text), IBM Plex Mono (Preise, Labels). Apple Mail lädt sie, Gmail nutzt die Ersatzschriften. */
export const F_DISPLAY = "'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif";
export const F_TEXT = "'Space Grotesk',Helvetica,Arial,sans-serif";
export const F_MONO = "'IBM Plex Mono','Courier New',monospace";
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">`;
export const wrap = (inner: string, preheader = "") => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">${FONTS}<style>h1{font-family:${F_DISPLAY};font-weight:400;text-transform:uppercase;letter-spacing:0.5px;line-height:1}a{color:#FBFF00}</style></head>
<body style="margin:0;padding:0;background:#111516">${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111516"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#000;border-top:6px solid #FBFF00">
<tr><td style="padding:28px 32px 8px"><a href="${SITE}"><img src="${SITE}/img/mail/logo-white.png" width="180" height="19" alt="SKILL CGN" style="display:block;border:0;width:180px;height:auto"></a></td></tr>
<tr><td style="padding:16px 32px 32px;font-family:${F_TEXT};font-size:16px;line-height:1.55;color:#fff">${inner}</td></tr>
<tr><td style="padding:20px 32px;background:#2A3133;font-family:${F_MONO};font-size:11px;line-height:1.7;letter-spacing:1px;color:#9aa3a6;text-transform:uppercase">SKILL CGN · HYROX Official Gym<br>Herzogstraße 16–20 · 50667 Köln · <a href="${SITE}" style="color:#FBFF00;text-decoration:none">skill-studios.com</a></td></tr>
</table></td></tr></table></body></html>`;

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
export const CHECKOUT_FROM = process.env.CHECKOUT_FROM_EMAIL || "SKILL CGN <info@skill-studios.com>";
/* ---------- Abbrecher-Mail (10 Minuten nach Schritt 1 ohne Vertrag): Inhalt je Kampagne ---------- */
const isGymOnly = (offer: string) => /BLACK WEEK|GYM ONLY/i.test(offer);
interface ReminderContent { subject: string; preheader: string; kicker: string; product: string; price: string; per: string; points: string[]; deadline?: string }
export function reminderContent(campaign: string, firstName: string): ReminderContent {
  if (isGymOnly(campaign)) return {
    subject: `${firstName}, dein Gym Only für 29 € ist noch offen`,
    preheader: "Deine Angaben sind gespeichert. In 2 Minuten fertig, nur bis 30.11.",
    kicker: "Black Week · nur bis 30.11.", product: "Gym Only", price: "29 €", per: "alle 4 Wochen",
    points: ["Gym komplett, alle Geräte", "Dusche, Getränke, Handtuch", "3D Scan und Assessment zum Start", "Monatlich kündbar, keine Aufnahmegebühr"],
    deadline: "Der Black Week Preis gilt nur für Abschlüsse bis 30.11.2026, 23:59 Uhr.",
  };
  const name = campaign.replace(/\s+/g, " ").trim() || "START 39";
  return {
    subject: `${firstName}, dein ${name} ist noch offen`,
    preheader: "Deine Angaben sind gespeichert. In 2 Minuten fertig.",
    kicker: "Nur online · nur Neukunden", product: name, price: "39 €", per: "alle 4 Wochen",
    points: ["Gym und 4 Classes je 4 Wochen", "3D Scan zum Start, Plan mit deinem Namen", "Dusche, Getränke, Handtuch", "Monatlich kündbar, keine Aufnahmegebühr"],
  };
}
export const reminderPriceLine = (campaign: string) => { const c = reminderContent(campaign, ""); return `${c.product} für ${c.price} ${c.per}`; };
export function reminderHtml(l: Pick<CheckoutLead, "campaign" | "firstName" | "path" | "token"> & { abandonedStep?: number }) {
  const c = reminderContent(l.campaign, l.firstName);
  const link = `${SITE}${l.path}?resume=${encodeURIComponent(l.token)}`;
  const check = (t: string) => `<tr><td width="26" valign="top" style="padding:5px 0;font-family:${F_TEXT};font-weight:700;color:#FBFF00">✓</td><td style="padding:5px 0;font-family:${F_TEXT};font-size:15px;color:#fff">${t}</td></tr>`;
  const html = wrap(`<p style="margin:0 0 14px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FBFF00">${c.kicker}</p>
<h1 style="margin:0 0 14px;font-family:${F_DISPLAY};font-weight:400;font-size:46px;line-height:0.95;letter-spacing:0.5px;text-transform:uppercase;color:#fff">Fast geschafft,<br><span style="color:#FBFF00">${l.firstName}.</span></h1>
<p style="margin:0 0 24px;color:#d4d8d9">${(l.abandonedStep || 0) >= 3 ? "Du bist kurz vor der Unterschrift stehen geblieben." : "Du hast deinen Abschluss gestartet, aber noch nicht beendet."} Deine Angaben sind gespeichert, du machst genau dort weiter, wo du aufgehört hast.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A3133;border-left:6px solid #FBFF00"><tr><td style="padding:20px 22px">
<p style="margin:0;font-family:${F_MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9aa3a6">${c.product}</p>
<p style="margin:4px 0 12px;font-family:${F_DISPLAY};font-size:56px;line-height:1;color:#FBFF00">${c.price} <span style="font-family:${F_MONO};font-size:13px;letter-spacing:1px;color:#fff">${c.per}</span></p>
<table role="presentation" cellpadding="0" cellspacing="0">${c.points.map(check).join("")}</table>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 10px"><tr><td align="center" bgcolor="#FBFF00" style="background:#FBFF00">
<a href="${link}" style="display:block;padding:18px 20px;font-family:${F_TEXT};font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#000;text-decoration:none;white-space:nowrap">Abschluss fertig machen&nbsp;→</a></td></tr></table>
<p style="margin:0 0 22px;text-align:center;font-family:${F_MONO};font-size:11px;letter-spacing:1px;color:#9aa3a6">Dauert 2 Minuten. Deine Angaben sind schon drin.</p>
${c.deadline ? `<p style="margin:0 0 22px;padding:12px 14px;border:2px solid #FBFF00;font-family:${F_MONO};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#FBFF00">${c.deadline}</p>` : ""}
<p style="margin:0;color:#d4d8d9;font-size:15px">Hakt etwas? Antworte einfach auf diese Mail oder schreib Boris per <a href="https://wa.me/4917610877603" style="color:#FBFF00">WhatsApp</a>.</p>`, c.preheader);
  return { subject: c.subject, html };
}
export async function sendCheckoutReminder(l: CheckoutLead) {
  if (!mailConfigured()) return false;
  const { subject, html } = reminderHtml(l);
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: CHECKOUT_FROM, to: l.email, subject, html, reply_to: "info@skill-studios.com" }) });
  return r.ok;
}

/* Hinweis ans Team (info@) bei Stripe-Ereignissen. Ohne RESEND_API_KEY nur Protokoll. */
export async function sendStaffAlert(subject: string, lines: string[]) {
  return send(STAFF_EMAIL, subject, wrap(`<h1 style="font-size:24px;margin:0 0 12px">${subject}</h1>${lines.map(l => `<p style="margin:0 0 8px">${l}</p>`).join("")}`));
}

/* ---------- Shop (Stripe Payment Link): Mail ans Team mit allen Käuferdaten, Bestätigung an den Käufer ---------- */
export interface ShopOrder { productId: string; productName: string; amount: number; name: string; email: string; phone: string; sessionId: string; credits: number; ptCredits: number; validUntil: string | null }
const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
export async function sendShopMails(o: ShopOrder) {
  const staff = await send(STAFF_EMAIL, `Shop-Verkauf: ${o.productName} — ${o.name || o.email}`, wrap(`<h1 style="font-size:24px;margin:0 0 12px">Shop-Verkauf</h1>
<table style="border-collapse:collapse;color:#fff;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#888">Produkt</td><td><strong>${o.productName}</strong> (${o.productId})</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Betrag</td><td>${eur(o.amount)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Name</td><td><strong>${o.name || "—"}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">E-Mail</td><td>${o.email || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Telefon</td><td>${o.phone || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Guthaben jetzt</td><td>${o.credits} Kurse${o.ptCredits ? `, ${o.ptCredits} PT` : ""}${o.validUntil ? `, gültig bis ${o.validUntil}` : ""}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Stripe-Sitzung</td><td style="font-family:monospace;font-size:12px">${o.sessionId}</td></tr>
</table><p style="margin-top:16px">Käufer am Empfang unter der E-Mail-Adresse finden, Ticket zuweisen.</p>`));
  const customer = o.email ? await send(o.email, `Dein ${o.productName} bei SKILL CGN`, wrap(`<h1 style="font-size:28px;margin:0 0 8px">Danke, ${o.name.split(" ")[0] || "willkommen"}.</h1>
<p style="font-size:18px;margin:0 0 16px">Dein <strong>${o.productName}</strong> (${eur(o.amount)}) ist bezahlt und auf deine E-Mail-Adresse hinterlegt.</p>
<p><strong>So geht es weiter</strong></p>
<p>1. Kurs aussuchen: <a href="${SITE}/classes" style="color:#FBFF00">skill-studios.com/classes</a>, dort siehst du den Live-Kursplan.</p>
<p>2. Komm 10 Minuten vor der Class in die Herzogstraße 16–20, nenn am Empfang deine E-Mail-Adresse, wir legen dein Ticket an.</p>
<p>3. Handtuch und Getränke bekommst du bei uns, saubere Sportschuhe und Sportkleidung bringst du mit.</p>
<p>Fragen oder Kurs vorab reservieren? <a href="https://wa.me/4917610877603" style="color:#FBFF00">WhatsApp +49 176 10877603</a></p>
<p style="color:#888;font-size:12px;margin-top:16px">Die Rechnung kommt separat von Stripe. Guthaben: ${o.credits} Kurse${o.ptCredits ? `, ${o.ptCredits} Personal-Training-Einheiten` : ""}${o.validUntil ? `, gültig bis ${o.validUntil}` : ""}.</p>`), STAFF_EMAIL) : false;
  return { staff, customer };
}

/* ---------- Mitgliedschaft: "Neuer Vertrag" ans Team (Willkommensmail: lib/welcome.ts) ---------- */
export interface ContractMail { firstName: string; lastName: string; email: string; phone: string; customerNumber?: string; contractId: string; offerName: string; price: number; startDate?: string; payment: "sepa" | "card" | "express"; months?: number; token?: string }
export async function sendContractMails(c: ContractMail) {
  const pay = c.payment === "sepa" ? "SEPA-Lastschrift (Magicline)" : c.payment === "express" ? "Stripe-Abo (Apple Pay / Google Pay)" : "Stripe-Abo (Karte / Wallet)";
  const start = c.startDate ? new Date(c.startDate + "T12:00:00").toLocaleDateString("de-DE") : "";
  const staff = await send(STAFF_EMAIL, `Neuer Vertrag: ${c.firstName} ${c.lastName} — ${c.offerName}`, wrap(`<h1 style="font-size:24px;margin:0 0 12px">Neuer Vertrag</h1>
<table style="border-collapse:collapse;color:#fff;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#888">Angebot</td><td><strong>${c.offerName}</strong>${c.months ? `, ${c.months === 12 ? "12 Monate" : "monatlich"}` : ""}, ${c.price} € alle vier Wochen</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Name</td><td><strong>${c.firstName} ${c.lastName}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">E-Mail</td><td>${c.email || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Telefon</td><td>${c.phone || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Magicline</td><td>Vertrag ${c.contractId}${c.customerNumber ? `, Kunde ${c.customerNumber}` : ""}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Start</td><td>${start || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Zahlung</td><td>${pay}</td></tr>
</table><p style="margin-top:16px">Scan-Termin vereinbaren, am ersten Trainingstag Einweisung.</p>`));
  /* Kundenmail kommt jetzt als ein Paket aus lib/welcome.ts (mit Vertrag und SEPA-Mandat als PDF, Issue #2). Hier nur noch die Teammail. */
  const customer = false;
  return { staff, customer };
}

/* ---------- Zahlung bei Stripe eingegangen, Magicline-Vertrag nicht angelegt: dringender Hinweis ans Team, Zwischenbescheid an den Kunden ---------- */
export async function sendContractFailedMails(c: Omit<ContractMail, "contractId"> & { error: string; stripe?: { sessionId?: string; subscriptionId?: string; customerId?: string } }) {
  const staff = await send(STAFF_EMAIL, `DRINGEND: Zahlung da, kein Vertrag — ${c.firstName} ${c.lastName} (${c.offerName})`, wrap(`<h1 style="font-size:24px;margin:0 0 12px">Zahlung eingegangen, Vertrag fehlt</h1>
<p>Stripe hat die Zahlung für <strong>${c.offerName}</strong> (${c.price} €) bestätigt, Magicline hat den Vertrag abgelehnt. Bitte den Vertrag von Hand in Magicline anlegen.</p>
<table style="border-collapse:collapse;color:#fff;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#888">Name</td><td><strong>${c.firstName} ${c.lastName}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">E-Mail</td><td>${c.email || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Telefon</td><td>${c.phone || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Magicline</td><td>Interessent ${c.customerNumber || "unbekannt"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Start</td><td>${c.startDate || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Stripe</td><td style="font-family:monospace;font-size:12px">${c.stripe?.subscriptionId || c.stripe?.sessionId || "—"}${c.stripe?.customerId ? ` / ${c.stripe.customerId}` : ""}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Fehler</td><td style="font-family:monospace;font-size:12px">${c.error.replace(/</g, "&lt;")}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Checkout-Token</td><td style="font-family:monospace;font-size:12px">${c.token || "—"}</td></tr>
</table>`));
  const customer = c.email ? await send(c.email, `Deine Zahlung ist da, ${c.firstName}`, wrap(`<h1 style="font-size:28px;margin:0 0 8px">Zahlung eingegangen.</h1>
<p style="font-size:18px;margin:0 0 16px">Danke, deine Zahlung für <strong>${c.offerName}</strong> ist bei uns angekommen. Dein Vertrag wird gerade von uns persönlich angelegt, du bekommst die Unterlagen in Kürze per E-Mail.</p>
<p>Wenn du Fragen hast oder direkt loslegen willst: <a href="https://wa.me/4917610877603" style="color:#FBFF00">WhatsApp +49 176 10877603</a>.</p>`), STAFF_EMAIL) : false;
  return { staff, customer };
}

/* ---------- Black Month (Aktion 2. bis 30.11.2026): drei Kundenmails von info@, Info je Kauf an Boris ---------- */
export interface BlackMonthBuyer { name: string; email: string; phone: string; amount: number; sessionId: string; magicline?: string | null; appointmentAt?: string | null }
const BM_FROM = CHECKOUT_FROM; // SKILL CGN <info@skill-studios.com>
const BM_NOTIFY = (process.env.BLACKMONTH_NOTIFY_EMAIL || "Boris.K@skill-studios.com").split(",").map((x: string) => x.trim()).filter(Boolean);
const BOOKING_URL = (process.env.BOOKING_URL || "").trim();
const BM_WA = "Schreib Boris per WhatsApp an 0176 10877603 mit deinem Wunschtag.";
const BM_ADDRESS = "SKILL CGN, Herzogstraße 16, 50667 Köln, zwei Minuten vom Neumarkt.";
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const bmDate = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
const bmTime = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
/** Textfassung ist die Quelle, die HTML-Fassung entsteht daraus (Absätze, Links klickbar). */
function bmHtml(paragraphs: string[]) {
  const link = (t: string) => esc(t).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#FBFF00">$1</a>');
  return wrap(paragraphs.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${link(p).replace(/\n/g, "<br>")}</p>`).join(""));
}
const bookingLine = () => BOOKING_URL ? `Such dir hier deinen Starttermin aus: ${BOOKING_URL}` : BM_WA;
const bmSignature = ["Bis bald im Studio\nBoris Kurowski\nSKILL CGN"];

/** Mail 1, sofort nach Zahlung. */
export async function sendBlackMonthWelcome(o: BlackMonthBuyer) {
  const first = firstName(o.name);
  const paragraphs = [
    `Hi${first ? " " + first : ""},`,
    "deine Zahlung ist angekommen, du bist dabei. Dein Black Month bei SKILL CGN: 6 Monate Gym, die Zeit läuft ab deinem ersten Trainingstag.",
    "Start bis spätestens 15.12.2026. " + bookingLine(),
    "Mitbringen: Sportsachen, saubere Sportschuhe, Handtuch.",
    "Adresse: " + BM_ADDRESS,
    "Die Rechnung kommt separat von Stripe. AGB und Widerruf findest du unter skill-studios.com/agb.",
    ...bmSignature,
  ];
  return sendFrom(BM_FROM, o.email, "Du bist dabei, dein Black Month bei SKILL CGN", bmHtml(paragraphs), { replyTo: "info@skill-studios.com", text: paragraphs.join("\n\n") });
}
/** Mail 2, drei Tage nach Kauf ohne Termin im Kalender. */
export async function sendBlackMonthNudge(o: BlackMonthBuyer) {
  const first = firstName(o.name);
  const paragraphs = [
    `Hi${first ? " " + first : ""},`,
    "dein Black Month wartet. Du hast noch keinen Starttermin, dabei beginnen deine 6 Monate erst mit dem ersten Training. Je früher du startest, desto mehr hast du davon.",
    "Start bis spätestens 15.12.2026. " + bookingLine(),
    "Mitbringen: Sportsachen, saubere Sportschuhe, Handtuch. Adresse: " + BM_ADDRESS,
    ...bmSignature,
  ];
  return sendFrom(BM_FROM, o.email, "Dein Starttermin fehlt noch, Black Month bei SKILL CGN", bmHtml(paragraphs), { replyTo: "info@skill-studios.com", text: paragraphs.join("\n\n") });
}
/** Mail 3, am Tag vor dem Termin. */
export async function sendBlackMonthReminder(o: BlackMonthBuyer & { appointmentAt: string }) {
  const first = firstName(o.name);
  const paragraphs = [
    `Hi${first ? " " + first : ""},`,
    `morgen geht es los: ${bmDate(o.appointmentAt)} um ${bmTime(o.appointmentAt)} Uhr ist dein Starttermin bei SKILL CGN. Komm bitte 10 Minuten früher, wir richten deinen Zugang ein und zeigen dir das Studio.`,
    "Mitbringen: Sportsachen, saubere Sportschuhe, Handtuch.",
    "Adresse: " + BM_ADDRESS,
    "Falls es nicht passt, schreib Boris kurz per WhatsApp an 0176 10877603.",
    ...bmSignature,
  ];
  return sendFrom(BM_FROM, o.email, "Morgen geht es los, dein Start bei SKILL CGN", bmHtml(paragraphs), { replyTo: "info@skill-studios.com", text: paragraphs.join("\n\n") });
}
/** Info je Kauf an Boris (BLACKMONTH_NOTIFY_EMAIL, Standard Boris.K@skill-studios.com) und ans Team-Postfach. */
export async function sendBlackMonthStaff(o: BlackMonthBuyer & { duplicate?: boolean; leadStatus?: number }) {
  const rows: [string, string][] = [["Name", o.name || "unbekannt"], ["Telefon", o.phone || "keine Angabe"], ["E-Mail", o.email || "keine Angabe"], ["Betrag", eur(o.amount)], ["Session ID", o.sessionId],
    ["Magicline", o.duplicate ? "Käufer war schon bekannt (E-Mail oder Telefon), kein neuer Interessent" : o.magicline ? `Interessent ${o.magicline} angelegt` : o.leadStatus === 409 ? "Kunde existiert bereits in Magicline" : "Interessent konnte nicht angelegt werden, bitte von Hand anlegen"]];
  const html = wrap(`<h1 style="font-size:24px;margin:0 0 12px">Black Month gekauft</h1><table style="border-collapse:collapse;color:#fff;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>`);
  const text = "Black Month gekauft\n\n" + rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const to = [...new Set([...BM_NOTIFY, STAFF_EMAIL])];
  return sendFrom(BM_FROM, to, `Black Month gekauft: ${o.name || o.email}, ${eur(o.amount)}`, html, { text });
}
