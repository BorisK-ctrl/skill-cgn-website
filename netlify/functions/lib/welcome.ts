/*
 * Ein Paket nach dem Abschluss (Issue #2): genau eine Willkommensmail von SKILL CGN <info@>, mit Vertrag und SEPA-Mandat als PDF
 * (aus der Magicline Open API, Kundendokumente), Onboarding-Termin-Button, was den Kunden erwartet, und den nächsten Schritten. Ersetzt die frühere Kundenmail
 * aus sendContractMails. Die Teammail "Neuer Vertrag" bleibt in notify.ts.
 *
 * Ablauf:
 * - Beim Abschluss (checkout-lead done / Stripe-Weg) deliverWelcome mit kurzem Zeitbudget: Dokumente da (mind. 2 PDFs) -> Mail mit Anhang.
 * - Sonst bleibt lead.welcome.pendingSince stehen, die 5-Minuten-Funktion (checkout-reminder) versucht es erneut.
 * - Spätestens 10 Minuten nach Abschluss geht die Mail auch ohne vollständige Dokumente raus (mit dem, was da ist, und dem Hinweis,
 *   dass der Vertrag separat kommt) und das Team bekommt eine Info, damit es den Vertrag von Hand nachschickt. Kein Käufer bleibt ohne Mail.
 */
import { wrap, sendFrom, CHECKOUT_FROM, F_DISPLAY, F_MONO, F_TEXT, send, type MailAttachment } from "./notify";
import { magiclineConfigured, listCustomerDocuments, downloadDocument, findCustomerByEmail } from "./magicline";
import { SITE, STAFF_EMAIL } from "./util";
import { getOnboarding, type CheckoutLead } from "./store";
import { onboardingLink } from "./onboarding-live";

const WA_NUMBER = "4917610877603";
const WA_DISPLAY = "0176 10877603";
export const WELCOME_FORCE_AFTER_MS = 10 * 60 * 1000;
const MAX_ATTACH_BYTES = 9 * 1024 * 1024;

export interface WelcomeInput { firstName: string; email: string; contractId: string; offerName: string; price: number; startDate?: string; months?: number }

const de = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00").toLocaleDateString("de-DE") : "");
const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}&nbsp;€`;
const eurText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;

interface OfferCopy { product: string; summary: (c: WelcomeInput) => string; steps: string[]; waText: string }
/* Onboarding (Boris, 18.11.2026): was den Kunden am Termin erwartet, gleich wie auf der Dankeseite (src/components/OnboardingNext.tsx) */
export const ONBOARDING_EXPECT = [
  ["3D-Körperscan und Assessment", "Dein Startpunkt in Zahlen: Muskeln, Körperfett, Haltung."],
  ["Dein Bändchen", "Damit kommst du ab dem Tag jederzeit ins Gym."],
  ["Dein Trainingsplan", "Wir erstellen ihn für dich, passend zu deinem Scan und deinem Ziel."],
  ["Einweisung, dann geht's los", "Wir zeigen dir Geräte und Ablauf. Danach startest du durch."],
] as const;
const MITBRINGEN = "Mitbringen: Sportklamotten und saubere Sportschuhe. Handtuch, Getränke und Dusche haben wir.";
/* /kursplan läuft ohne Open-API-Schlüssel nur mit Testdaten, daher hier der Weg, den es sicher gibt */
const kursplan = `Classes buchst du über die App oder auf <a href="${SITE}/classes" style="color:#FBFF00">skill-studios.com/classes</a>.`;
const facilities = "Dusche, Getränke und Handtuch sind drin.";
const vertragZeile = (c: WelcomeInput) => `Vertrag ${c.contractId}${de(c.startDate) ? `, Start ${de(c.startDate)}` : ""}.`;

/** Inhalte je Angebot (Magicline-Name wie in CAMPAIGNS bzw. offerName). */
export function offerCopy(offerName: string, months?: number): OfferCopy {
  const o = offerName.toUpperCase();
  if (/BLACK WEEK|GYM ONLY/.test(o)) return {
    product: "ONLY GYM 29",
    summary: c => `ONLY GYM 29, ${eur(c.price)} alle 4 Wochen, Laufzeit 1 Monat, monatlich kündbar, 0&nbsp;€ Aufnahmegebühr. ${vertragZeile(c)} Erste Abbuchung anteilig bis zum Ende des Abrechnungszeitraums, danach ${eur(c.price)} alle 4 Wochen.`,
    steps: ["Mit deinem Bändchen trainierst du zu den Öffnungszeiten, so oft du willst.", `Dusche, Getränke, Handtuch sind drin. Classes nicht, Drop In und Trial Pass gibt es im <a href="${SITE}/shop" style="color:#FBFF00">Shop</a>.`],
    waText: "Hi Boris, ich habe gerade Gym Only 29 gebucht. Wann passt mein Onboarding?",
  };
  if (o.includes("START 39")) return {
    product: "START 39",
    summary: c => `START 39, ${eur(c.price)} alle 4 Wochen, Laufzeit 1 Monat, monatlich kündbar, 0&nbsp;€ Aufnahmegebühr. ${vertragZeile(c)}`,
    steps: [`4 Classes je 4 Wochen mit Coach. ${kursplan}`, facilities],
    waText: "Hi Boris, ich habe gerade START 39 gebucht. Wann passt mein Onboarding?",
  };
  if (o.includes("BACK 39")) return {
    product: "BACK 39",
    summary: c => `BACK 39, ${eur(c.price)} alle 4 Wochen, ${months === 12 ? "12 Monate Laufzeit mit Recovery Bonus" : "monatlich kündbar"}, 0&nbsp;€ Aufnahmegebühr. ${vertragZeile(c)}`,
    steps: [`Coach in jeder Class. ${kursplan}`, facilities],
    waText: "Hi Boris, ich bin mit BACK 39 zurück. Wann passt mein Onboarding?",
  };
  const name = offerName.replace(/\s+/g, " ").trim() || "Mitgliedschaft";
  return {
    product: name,
    summary: c => `${name}, ${eur(c.price)} alle 4 Wochen, ${months === 12 ? "12 Monate Laufzeit" : "monatlich kündbar"}, 0&nbsp;€ Aufnahmegebühr. ${vertragZeile(c)}`,
    steps: [`Classes laut deinem Tarif. ${kursplan}`, facilities],
    waText: `Hi Boris, ich habe gerade ${name} abgeschlossen. Wann passt mein Onboarding?`,
  };
}

/** Termin-Button: persönlicher Link zur Terminwahl (/onboarding?t=…, Google-Kalender-Anbindung), sonst Google-Terminplan (ONBOARDING_BOOKING_URL), sonst die offene Seite /onboarding (Wunschtermin). */
function scanButton(copy: OfferCopy, personal?: string): { label: string; href: string } {
  if (personal) return { label: "Onboarding-Termin buchen", href: personal };
  /* Nie die Probetraining-Terminseite als Onboarding-Link (stand am 19.11.2026 versehentlich in Netlify) */
  const raw = process.env.ONBOARDING_BOOKING_URL?.trim(), booking = raw && !raw.includes("AcZssZ10Q9b0R58FnSdP") ? raw : "";
  if (booking) return { label: "Onboarding-Termin buchen", href: booking };
  /* Ohne Google-Anbindung: offene Seite mit Kalender (Wunschtermin, das Team bestätigt). Boris, 19.11.2026: Kalender statt WhatsApp. */
  return { label: "Onboarding-Termin wählen", href: `${SITE}/onboarding` };
}

export interface WelcomeOnboarding { url?: string; booked?: { start: string; end: string } }
const bDay = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const bTime = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export function welcomeMail(c: WelcomeInput, opts: { attachedDocs: number; onboarding?: WelcomeOnboarding }) {
  const copy = offerCopy(c.offerName, c.months);
  const btn = scanButton(copy, opts.onboarding?.url);
  const booked = opts.onboarding?.booked;
  const anhang = opts.attachedDocs >= 2 ? "Im Anhang: dein Vertrag und das SEPA-Mandat."
    : opts.attachedDocs === 1 ? "Im Anhang: ein Teil deiner Vertragsunterlagen. Den Rest schicken wir dir separat."
    : "Deinen Vertrag und das SEPA-Mandat schicken wir dir separat per Mail.";
  const label = (t: string) => `<p style="margin:26px 0 8px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9aa3a6">${t}</p>`;
  const step = (n: number, t: string) => `<tr><td width="38" valign="top" style="padding:8px 0;font-family:${F_DISPLAY};font-size:28px;line-height:1;color:#FBFF00">0${n}</td><td style="padding:8px 0;font-family:${F_TEXT};font-size:15px;line-height:1.5;color:#d4d8d9">${t}</td></tr>`;
  const button = (b: { label: string; href: string }) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td align="center" bgcolor="#FBFF00" style="background:#FBFF00"><a href="${b.href}" style="display:block;padding:18px 20px;font-family:${F_TEXT};font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#000;text-decoration:none;white-space:nowrap">${b.label}&nbsp;→</a></td></tr></table>`;
  const html = wrap(`<p style="margin:0 0 14px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FBFF00">Vertrag angelegt</p>
<h1 style="margin:0 0 18px;font-family:${F_DISPLAY};font-weight:400;font-size:46px;line-height:0.95;text-transform:uppercase;color:#fff">Du bist drin,<br><span style="color:#FBFF00">${c.firstName}.</span></h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A3133;border-left:6px solid #FBFF00"><tr><td style="padding:16px 20px;font-family:${F_TEXT};font-size:15px;line-height:1.55;color:#fff">${copy.summary(c)}</td></tr></table>
<p style="margin:12px 0 0;font-size:14px;color:#d4d8d9">${anhang}</p>
${booked ? `${label("Dein Onboarding")}
<p style="margin:0 0 6px;font-family:${F_DISPLAY};font-size:30px;line-height:1;text-transform:uppercase;color:#fff">Termin steht.</p>
<p style="margin:0;font-family:${F_MONO};font-size:17px;color:#FBFF00">${bDay(booked.start)}, ${bTime(booked.start)} bis ${bTime(booked.end)} Uhr</p>
<p style="margin:6px 0 0;font-size:14px;color:#d4d8d9">Die Bestätigung mit Kalendereintrag hast du separat bekommen.</p>` : `${label("Dein nächster Schritt")}
<p style="margin:0 0 10px;font-family:${F_DISPLAY};font-size:30px;line-height:1;text-transform:uppercase;color:#fff">Buch deinen Onboarding-Termin.</p>
${button(btn)}
${btn.label === "Onboarding-Termin buchen" ? `<p style="margin:8px 0 0;text-align:center;font-family:${F_MONO};font-size:11px;letter-spacing:1px;color:#9aa3a6">Oder schreib Boris per <a href="https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(copy.waText)}" style="color:#FBFF00">WhatsApp</a></p>` : ""}`}
${label("Das erwartet dich beim Onboarding")}
<p style="margin:0 0 6px;font-size:14px;color:#d4d8d9">90 Minuten mit Coach, bei uns in der Herzogstraße.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ONBOARDING_EXPECT.map(([t, d], i) => step(i + 1, `<strong style="color:#fff">${t}</strong><br>${d}`)).join("")}</table>
<p style="margin:10px 0 0;padding:12px 14px;border:1px solid #3a4245;font-size:14px;color:#d4d8d9">${MITBRINGEN}</p>
${label("Danach")}
<ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.6;color:#d4d8d9">${copy.steps.map(t => `<li style="margin:0 0 6px">${t}</li>`).join("")}</ul>
${label("Gut zu wissen")}
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#d4d8d9"><strong style="color:#fff">Öffnungszeiten:</strong> Montag bis Donnerstag 7 bis 22 Uhr, Freitag 7 bis 20 Uhr, Samstag und Sonntag 9 bis 20 Uhr.</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#d4d8d9"><strong style="color:#fff">Adresse:</strong> Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#d4d8d9"><strong style="color:#fff">Widerruf:</strong> 14 Tage. Kündigung unter <a href="${SITE}/kuendigung" style="color:#FBFF00">skill-studios.com/kuendigung</a>.</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#d4d8d9"><strong style="color:#fff">Fragen:</strong> WhatsApp <a href="https://wa.me/${WA_NUMBER}" style="color:#FBFF00">${WA_DISPLAY}</a> oder einfach auf diese Mail antworten.</p>`,
    booked ? `${copy.product}: dein Vertrag ist angelegt. Onboarding am ${bDay(booked.start)}, ${bTime(booked.start)} Uhr.` : `${copy.product}: dein Vertrag ist angelegt. Nächster Schritt: Onboarding-Termin buchen.`);
  const textSummary = copy.summary(c).replace(/&nbsp;/g, " ");
  const text = [`Du bist drin, ${c.firstName}.`, "", textSummary, anhang, "", booked ? `Dein Onboarding: ${bDay(booked.start)}, ${bTime(booked.start)} bis ${bTime(booked.end)} Uhr.` : `Dein nächster Schritt: ${btn.label}: ${btn.href}`, "",
    "Das erwartet dich beim Onboarding (90 Minuten mit Coach):", ...ONBOARDING_EXPECT.map(([t, d], i) => `${i + 1}. ${t}: ${d}`), MITBRINGEN, "",
    "Danach:", ...copy.steps.map(t => `- ${t.replace(/<[^>]+>/g, "")}`), "",
    "Gut zu wissen:", "Öffnungszeiten: Mo bis Do 7 bis 22 Uhr, Fr 7 bis 20 Uhr, Sa und So 9 bis 20 Uhr.", "Adresse: Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.",
    `Widerruf: 14 Tage. Kündigung: ${SITE}/kuendigung`, `Fragen: WhatsApp ${WA_DISPLAY} oder auf diese Mail antworten.`, "", "SKILL CGN · Herzogstraße 16–20 · 50667 Köln"].join("\n");
  return { subject: `Willkommen bei SKILL CGN, ${c.firstName}: dein ${copy.product}`, html, text };
}

/** Vertrag und SEPA-Mandat: PDFs des Kunden, die im Zeitfenster um den Abschluss entstanden sind. */
async function contractAttachments(customerId: number, sinceMs: number): Promise<MailAttachment[]> {
  const docs = (await listCustomerDocuments(customerId))
    .filter(d => /\.pdf$/i.test(d.fileName || "") && d.url && (!d.createdDateTime || Date.parse(d.createdDateTime) >= sinceMs))
    .sort((a, b) => Date.parse(a.createdDateTime || "") - Date.parse(b.createdDateTime || ""))
    .slice(0, 4);
  const out: MailAttachment[] = []; let bytes = 0;
  for (const d of docs) {
    const f = await downloadDocument(d.url!);
    if (bytes + f.bytes > MAX_ATTACH_BYTES) break;
    bytes += f.bytes; out.push({ filename: d.fileName, content: f.base64 });
  }
  return out;
}

async function resolveCustomerId(l: CheckoutLead): Promise<number | null> {
  const w = l.welcome;
  if (w?.customerId) return w.customerId;
  try { const c = await findCustomerByEmail(l.email); return c?.id ?? null; } catch (e) { console.log("welcome: Kunde nicht gefunden", String(e).slice(0, 160)); return null; }
}

/**
 * Versucht die eine Willkommensmail zu senden. Ändert lead.welcome; der Aufrufer speichert den Lead.
 * budgetMs: wie lange nach Dokumenten gesucht wird (Abschluss-Aufruf kurz, damit die Funktion nicht in den Timeout läuft).
 * force: nach WELCOME_FORCE_AFTER_MS auch ohne vollständige Dokumente senden.
 */
export async function deliverWelcome(l: CheckoutLead, input: WelcomeInput, opts: { budgetMs: number; force?: boolean }): Promise<"sent" | "pending" | "skipped"> {
  if (!l.email) return "skipped";
  l.welcome ??= { pendingSince: new Date().toISOString() };
  if (l.welcome.sentAt || l.welcome.skipped) return "skipped";
  /* Ohne Open-API-Schlüssel kommen wir nicht an Vertrag und SEPA-Mandat. Dann ist die Magicline-Mail "Neues Mitglied" (mit PDF)
     die eine Mail und die Website schickt dem Kunden nichts zusätzlich (Variante B1 aus Issue #2). Mit Schlüssel: unser Paket. */
  if (!magiclineConfigured()) { l.welcome.skipped = "MAGICLINE_OPEN_API_KEY fehlt, Magicline-Mail ist die Willkommensmail"; return "skipped"; }
  const since = Date.parse(l.welcome.pendingSince) - 10 * 60 * 1000; // Dokumente entstehen mit dem Vertrag, kurz vor dem Abschluss-Aufruf
  let att: MailAttachment[] = [];
  if (magiclineConfigured()) {
    const cid = await resolveCustomerId(l);
    if (cid) l.welcome.customerId = cid;
    const until = Date.now() + opts.budgetMs;
    for (let i = 0; cid; i++) {
      try { att = await contractAttachments(cid, since); } catch (e) { l.welcome.note = String(e).slice(0, 160); console.log("welcome: Dokumente", l.welcome.note); }
      if (att.length >= 2 || Date.now() + 3000 > until) break;
      await new Promise(r => setTimeout(r, 2500));
    }
  }
  if (att.length < 2 && !opts.force) { l.welcome.tries = (l.welcome.tries || 0) + 1; return "pending"; }
  /* Onboarding: schon auf der Dankeseite gebucht -> Termin nennen, sonst persönlicher Link zur Terminwahl (leer ohne Google-Zugang) */
  const rec = await getOnboarding(l.email).catch(() => null);
  const onboarding: WelcomeOnboarding = rec && Date.parse(rec.end) > Date.now() ? { booked: { start: rec.start, end: rec.end } }
    : { url: onboardingLink({ name: `${l.firstName} ${l.lastName}`, email: l.email, phone: l.phone, offer: l.campaign, ref: l.contractId ? "ml:" + l.contractId : undefined }) || undefined };
  const mail = welcomeMail(input, { attachedDocs: att.length, onboarding });
  const ok = await sendFrom(CHECKOUT_FROM, l.email, mail.subject, mail.html, { replyTo: "info@skill-studios.com", text: mail.text, attachments: att });
  if (!ok) { l.welcome.tries = (l.welcome.tries || 0) + 1; l.welcome.note = "Versand fehlgeschlagen"; return "pending"; }
  l.welcome.sentAt = new Date().toISOString(); l.welcome.docs = att.length;
  if (att.length < 2) {
    await send(STAFF_EMAIL, `Vertrag nachschicken: ${l.firstName} ${l.lastName} (${input.offerName})`, wrap(`<h1 style="font-size:24px;margin:0 0 12px">Vertrag nachschicken</h1><p>Die Willkommensmail an ${l.email} ging nach 10 Minuten ohne vollständige Vertragsunterlagen raus (${att.length} von 2 PDFs). Bitte Vertrag ${input.contractId} und SEPA-Mandat aus Magicline von Hand schicken.</p><p style="color:#888;font-size:12px">${l.welcome.note || ""}</p>`)).catch(() => false);
  }
  return "sent";
}

export function welcomeInputFromLead(l: CheckoutLead): WelcomeInput | null {
  const w = l.welcome;
  if (!w?.input || !l.contractId) return null;
  return { firstName: l.firstName, email: l.email, contractId: l.contractId, offerName: w.input.offerName, price: w.input.price, startDate: w.input.startDate, months: l.months };
}
