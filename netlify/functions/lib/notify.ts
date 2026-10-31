/* E-Mail über Resend, falls RESEND_API_KEY gesetzt. Sonst still überspringen (Buchung gilt trotzdem). */
import { STAFF_EMAIL, SITE, fmtDate, berlinTime } from "./util";
import type { Booking } from "./types";

const FROM = process.env.BOOKING_FROM_EMAIL || "SKILL CGN <buchung@skill-studios.com>";
/* Solange skill-studios.com bei Resend nicht verifiziert ist, lehnt Resend eigene Absender ab (403). Der Testabsender darf nur an die
   Konto-Adresse (info@) senden: damit kommen Team-Mails trotzdem an, Kundenmails erst nach der Domain-Verifizierung. */
const TEST_FROM = "SKILL CGN <onboarding@resend.dev>";
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

async function post(from: string, to: string, subject: string, html: string, replyTo?: string) {
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }) });
  const body = r.ok ? "" : (await r.text().catch(() => "")).slice(0, 200);
  return { ok: r.ok, status: r.status, body };
}
export async function send(to: string, subject: string, htmlBody: string, replyTo?: string) {
  if (!mailConfigured()) { console.log(`mail übersprungen (RESEND_API_KEY fehlt): ${subject}`); return false; }
  let r = await post(FROM, to, subject, htmlBody, replyTo);
  if (!r.ok && (r.status === 403 || r.status === 422) && to.toLowerCase() === STAFF_EMAIL.toLowerCase()) {
    console.log(`mail: Absender ${FROM} abgelehnt (${r.status} ${r.body}), Team-Mail über Testabsender`);
    r = await post(TEST_FROM, to, subject, htmlBody, replyTo);
  }
  console.log(`mail ${r.ok ? "gesendet" : "FEHLER " + r.status + " " + r.body}: "${subject}" an ${to}`);
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
<p>3. Handtuch und Getränke bekommst du bei uns, Hallenschuhe und Sportkleidung bringst du mit.</p>
<p>Fragen oder Kurs vorab reservieren? <a href="https://wa.me/4917610877603" style="color:#FBFF00">WhatsApp +49 176 10877603</a></p>
<p style="color:#888;font-size:12px;margin-top:16px">Die Rechnung kommt separat von Stripe. Guthaben: ${o.credits} Kurse${o.ptCredits ? `, ${o.ptCredits} Personal-Training-Einheiten` : ""}${o.validUntil ? `, gültig bis ${o.validUntil}` : ""}.</p>`), STAFF_EMAIL) : false;
  return { staff, customer };
}

/* ---------- Mitgliedschaft: "Neuer Vertrag" ans Team, Willkommensmail an das Mitglied ---------- */
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
  const customer = c.email ? await send(c.email, `Willkommen bei SKILL CGN, ${c.firstName}`, wrap(`<h1 style="font-size:28px;margin:0 0 8px">Du bist dabei.</h1>
<p style="font-size:18px;margin:0 0 16px">Dein <strong>${c.offerName}</strong> Vertrag ist angelegt (Vertragsnummer ${c.contractId})${start ? `, Start am ${start}` : ""}. ${c.price} € alle vier Wochen.</p>
<p><strong>So geht es weiter</strong></p>
<p>1. Schreib Boris kurz per <a href="https://wa.me/4917610877603?text=${encodeURIComponent(`Hi Boris, ich habe gerade ${c.offerName} abgeschlossen, ${c.firstName}. Wann kann ich zum Scan kommen?`)}" style="color:#FBFF00">WhatsApp</a> für deinen 3D-Scan-Termin.</p>
<p>2. Komm zu deinem ersten Training in die Herzogstraße 16–20, zwei Minuten vom Neumarkt. Wir richten vor Ort alles ein und zeigen dir das Studio.</p>
<p>3. Kurse buchst du über die App oder auf <a href="${SITE}/classes" style="color:#FBFF00">skill-studios.com/classes</a>. Handtuch und Getränke gibt es bei uns.</p>
<p style="color:#888;font-size:12px;margin-top:16px">Die Vertragsunterlagen kommen separat aus unserem Mitgliedersystem (Magicline). Kündigen kannst du jederzeit unter <a href="${SITE}/kuendigung" style="color:#FBFF00">skill-studios.com/kuendigung</a>.</p>`), STAFF_EMAIL) : false;
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

/* ---------- Black Month: Bestätigung an Käufer, Info ans Team ---------- */
export async function sendBlackMonthMails(o: { name: string; email: string; phone: string; amount: number; sessionId: string; magicline?: string }) {
  const first = o.name.split(" ")[0] || "";
  const staff = await send(STAFF_EMAIL, `Black Month gebucht: ${o.name || o.email}`, wrap(`<h1 style="font-size:24px;margin:0 0 12px">Black Month, 6 Monate Gym</h1>
<table style="border-collapse:collapse;color:#fff;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#888">Name</td><td><strong>${o.name || "—"}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">E-Mail</td><td>${o.email || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Telefon</td><td>${o.phone || "—"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Betrag</td><td>${eur(o.amount)} einmalig</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Magicline</td><td>${o.magicline ? `Interessent ${o.magicline}, Notiz "Black Month 6 Monate Gym 149 € bezahlt"` : "Interessent konnte nicht angelegt werden, bitte von Hand"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#888">Stripe-Sitzung</td><td style="font-family:monospace;font-size:12px">${o.sessionId}</td></tr>
</table><p style="margin-top:16px">Beim ersten Besuch den Gym-Zugang für sechs Monate einrichten.</p>`));
  const customer = o.email ? await send(o.email, `Dein Black Month bei SKILL CGN${first ? ", " + first : ""}`, wrap(`<h1 style="font-size:28px;margin:0 0 8px">Black Month gebucht.</h1>
<p style="font-size:18px;margin:0 0 16px">Danke${first ? ", " + first : ""}. Deine Zahlung über <strong>${eur(o.amount)}</strong> ist da: sechs Monate Gym bei SKILL CGN, einmalig, kein Abo.</p>
<p><strong>So geht es weiter</strong></p>
<p>1. Komm zu den Öffnungszeiten in die Herzogstraße 16–20, zwei Minuten vom Neumarkt.</p>
<p>2. Nenn am Empfang deine E-Mail-Adresse, wir richten deinen Zugang ein. Deine sechs Monate starten mit diesem ersten Besuch.</p>
<p>3. Handtuch und Getränke gibt es bei uns, Hallenschuhe und Sportkleidung bringst du mit.</p>
<p>Fragen? <a href="https://wa.me/4917610877603" style="color:#FBFF00">WhatsApp +49 176 10877603</a></p>
<p style="color:#888;font-size:12px;margin-top:16px">Die Rechnung kommt separat von Stripe. Classes sind nicht enthalten.</p>`), STAFF_EMAIL) : false;
  return { staff, customer };
}
