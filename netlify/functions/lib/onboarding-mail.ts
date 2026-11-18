/*
 * Bestätigung nach der Onboarding-Buchung (Dankeseite oder /onboarding): eine Mail an den Kunden im CI (wie die Willkommensmail, lib/welcome.ts)
 * und eine Info ans Team. Absender info@, Antworten landen im Team-Postfach.
 */
import { wrap, sendFrom, CHECKOUT_FROM, F_DISPLAY, F_MONO, F_TEXT } from "./notify";
import { ONBOARDING_EXPECT } from "./welcome";
import { SITE, STAFF_EMAIL } from "./util";

const WA_NUMBER = "4917610877603";
const WA_DISPLAY = "0176 10877603";
export const MITBRINGEN = "Sportklamotten und saubere Hallenschuhe. Handtuch, Getränke und Dusche haben wir.";
const esc = (t: string) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const first = (name: string) => name.trim().split(/\s+/)[0] || "";

export interface OnboardingMail { name: string; email: string; phone?: string; offer?: string; start: string; end: string; coach: string; coachFull: string; google: string; ics: string; minutes: number; uncertain?: string[] }

export function onboardingCustomerMail(o: OnboardingMail) {
  const when = `${day(o.start)}`, hours = `${time(o.start)} bis ${time(o.end)} Uhr`;
  const wa = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hi Boris, ich muss meinen Onboarding-Termin am ${day(o.start)} um ${time(o.start)} Uhr verschieben.`)}`;
  const label = (t: string) => `<p style="margin:26px 0 8px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9aa3a6">${t}</p>`;
  const step = (n: number, t: string) => `<tr><td width="38" valign="top" style="padding:8px 0;font-family:${F_DISPLAY};font-size:28px;line-height:1;color:#FBFF00">0${n}</td><td style="padding:8px 0;font-family:${F_TEXT};font-size:15px;line-height:1.5;color:#d4d8d9">${t}</td></tr>`;
  const calBtn = (href: string, text: string) => `<td width="50%" style="padding:0 4px"><a href="${href}" style="display:block;padding:14px 8px;border:2px solid #FBFF00;font-family:${F_TEXT};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FBFF00;text-decoration:none;text-align:center">${text}</a></td>`;
  const html = wrap(`<p style="margin:0 0 14px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FBFF00">Onboarding gebucht</p>
<h1 style="margin:0 0 18px;font-family:${F_DISPLAY};font-weight:400;font-size:46px;line-height:0.95;text-transform:uppercase;color:#fff">Termin steht,<br><span style="color:#FBFF00">${esc(first(o.name))}.</span></h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A3133;border-left:6px solid #FBFF00"><tr><td style="padding:16px 20px;font-family:${F_TEXT};font-size:15px;line-height:1.55;color:#fff">
<span style="font-family:${F_MONO};font-size:17px;color:#FBFF00">${esc(when)}<br>${hours}</span><br>
<span style="color:#d4d8d9">Mit ${esc(o.coach)}, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.</span></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr>${calBtn(o.google, "Google Kalender")}${calBtn(o.ics, "Apple / Outlook")}</tr></table>
${label("Das erwartet dich")}
<p style="margin:0 0 6px;font-size:14px;color:#d4d8d9">${o.minutes} Minuten mit deinem Coach.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ONBOARDING_EXPECT.map(([t, d], i) => step(i + 1, `<strong style="color:#fff">${t}</strong><br>${d}`)).join("")}</table>
<p style="margin:10px 0 0;padding:12px 14px;border:1px solid #3a4245;font-size:14px;color:#d4d8d9"><strong style="color:#fff">Mitbringen:</strong> ${MITBRINGEN}</p>
${label("Termin passt doch nicht?")}
<p style="margin:0;font-size:14px;line-height:1.6;color:#d4d8d9">Schreib Boris per <a href="${wa}" style="color:#FBFF00">WhatsApp ${WA_DISPLAY}</a> oder antworte auf diese Mail. Wir finden einen neuen Termin.</p>`,
    `${when}, ${hours}: dein Onboarding bei SKILL CGN.`);
  const text = [`Termin steht, ${first(o.name)}.`, "", `${when}, ${hours}`, `Mit ${o.coach}, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.`, "",
    `In Google Kalender: ${o.google}`, `Apple / Outlook: ${o.ics}`, "",
    `Das erwartet dich (${o.minutes} Minuten mit deinem Coach):`, ...ONBOARDING_EXPECT.map(([t, d], i) => `${i + 1}. ${t}: ${d}`), `Mitbringen: ${MITBRINGEN}`, "",
    `Termin passt doch nicht? WhatsApp ${WA_DISPLAY} oder auf diese Mail antworten.`, "", `SKILL CGN · Herzogstraße 16–20 · 50667 Köln · ${SITE.replace(/^https?:\/\//, "")}`].join("\n");
  return { subject: `Dein Onboarding: ${day(o.start)}, ${time(o.start)} Uhr`, html, text };
}

export async function sendOnboardingMails(o: OnboardingMail) {
  const m = onboardingCustomerMail(o);
  const customer = await sendFrom(CHECKOUT_FROM, o.email, m.subject, m.html, { replyTo: STAFF_EMAIL, text: m.text }).then(Boolean).catch(e => { console.log("onboarding mail kunde", String(e)); return false; });
  const rows: [string, string][] = [["Wann", `${day(o.start)}, ${time(o.start)} bis ${time(o.end)} Uhr`], ["Coach", o.coachFull], ["Kunde", o.name], ["E-Mail", o.email], ["Telefon", o.phone || "keine Angabe"], ["Angebot", o.offer || "keine Angabe"]];
  /* Termin ohne sicheren Coach zur selben Zeit: der Coach ist frei gerechnet, aber wer den anderen Termin macht, steht nicht im Kalender */
  const check = o.uncertain?.length ? `Bitte prüfen: Zur selben Zeit steht ohne sicheren Coach im Kalender: ${o.uncertain.join(", ")}. Falls ${o.coach} den macht, übernimmt ein anderer Coach das Onboarding. Tipp: Coach als Gast eintragen, dann ist es eindeutig.` : "";
  const staffHtml = wrap(`<h1 style="font-size:28px;margin:0 0 12px">Onboarding gebucht</h1><table style="border-collapse:collapse;color:#fff;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#9aa3a6">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>${check ? `<p style="margin:16px 0 0;padding:12px 14px;border-left:6px solid #FBFF00;background:#2A3133;font-size:14px;color:#fff">${esc(check)}</p>` : ""}<p style="margin-top:16px;font-size:14px;color:#d4d8d9">Steht im Kalender "Onboarding". Gebucht über die Website.</p>`);
  const staff = await sendFrom(CHECKOUT_FROM, STAFF_EMAIL, `${o.uncertain?.length ? "Bitte prüfen: " : ""}Onboarding gebucht: ${o.name}, ${day(o.start)} ${time(o.start)} (${o.coach})`, staffHtml, { text: [...rows.map(([k, v]) => `${k}: ${v}`), check].filter(Boolean).join("\n") }).then(Boolean).catch(e => { console.log("onboarding mail team", String(e)); return false; });
  return { customer, staff };
}
