/*
 * Bestätigung nach der Buchung über die Website (Onboarding 90 Min, Probetraining 30 Min): eine Mail an den Kunden im CI
 * (wie die Willkommensmail, lib/welcome.ts) und eine Info ans Team. Absender info@, Antworten landen im Team-Postfach.
 */
import { wrap, sendFrom, CHECKOUT_FROM, F_DISPLAY, F_MONO, F_TEXT } from "./notify";
import { ONBOARDING_EXPECT } from "./welcome";
import { SITE, STAFF_EMAIL } from "./util";

const WA_NUMBER = "4917610877603";
const WA_DISPLAY = "0176 10877603";
const TECHNOGYM_APP = "https://tgapp-link.mywellness.com/39a898ba9"; // wie src/lib/magicline.ts
export const MITBRINGEN = "Sportklamotten und saubere Hallenschuhe. Handtuch, Getränke und Dusche haben wir.";
/* Probetraining: Inhalt wie auf /probetraining (FAQ) */
const PROBE_EXPECT = [
  ["Erstgespräch", "Was ist dein Ziel, was hast du bisher gemacht, was passt zu dir."],
  ["3D-Körperscan", "Körperfett, Muskelmasse und Haltung als Zahlen. Der Coach erklärt dir, was sie bedeuten."],
] as const;
const COPY = {
  onboarding: { label: "Onboarding", expect: ONBOARDING_EXPECT, calendarName: "Onboarding" },
  probetraining: { label: "Probetraining", expect: PROBE_EXPECT, calendarName: "Probetraining" },
} as const;
const esc = (t: string) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const first = (name: string) => name.trim().split(/\s+/)[0] || "";

export interface OnboardingMail { kind?: "onboarding" | "probetraining"; name: string; email: string; phone?: string; offer?: string; start: string; end: string; coach: string; coachFull: string; google: string; ics: string; minutes: number; uncertain?: string[] }

export function onboardingCustomerMail(o: OnboardingMail) {
  const c = COPY[o.kind || "onboarding"];
  const when = `${day(o.start)}`, hours = `${time(o.start)} bis ${time(o.end)} Uhr`;
  const wa = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hi Boris, ich muss mein ${c.label} am ${day(o.start)} um ${time(o.start)} Uhr verschieben.`)}`;
  const label = (t: string) => `<p style="margin:26px 0 8px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9aa3a6">${t}</p>`;
  const step = (n: number, t: string) => `<tr><td width="38" valign="top" style="padding:8px 0;font-family:${F_DISPLAY};font-size:28px;line-height:1;color:#FBFF00">0${n}</td><td style="padding:8px 0;font-family:${F_TEXT};font-size:15px;line-height:1.5;color:#d4d8d9">${t}</td></tr>`;
  const calBtn = (href: string, text: string) => `<td width="50%" style="padding:0 4px"><a href="${href}" style="display:block;padding:14px 8px;border:2px solid #FBFF00;font-family:${F_TEXT};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FBFF00;text-decoration:none;text-align:center">${text}</a></td>`;
  const html = wrap(`<p style="margin:0 0 14px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FBFF00">${c.label} gebucht</p>
<h1 style="margin:0 0 18px;font-family:${F_DISPLAY};font-weight:400;font-size:46px;line-height:0.95;text-transform:uppercase;color:#fff">Termin steht,<br><span style="color:#FBFF00">${esc(first(o.name))}.</span></h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A3133;border-left:6px solid #FBFF00"><tr><td style="padding:16px 20px;font-family:${F_TEXT};font-size:15px;line-height:1.55;color:#fff">
<span style="font-family:${F_MONO};font-size:17px;color:#FBFF00">${esc(when)}<br>${hours}</span><br>
<span style="color:#d4d8d9">${c.label} mit ${esc(o.coach)}, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.</span></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr>${calBtn(o.google, "Google Kalender")}${calBtn(o.ics, "Apple / Outlook")}</tr></table>
${label("Das erwartet dich")}
<p style="margin:0 0 6px;font-size:14px;color:#d4d8d9">${o.minutes} Minuten mit deinem Coach.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.expect.map(([t, d], i) => step(i + 1, `<strong style="color:#fff">${t}</strong><br>${d}`)).join("")}</table>
<p style="margin:10px 0 0;padding:12px 14px;border:1px solid #3a4245;font-size:14px;color:#d4d8d9"><strong style="color:#fff">Mitbringen:</strong> ${MITBRINGEN}</p>
${o.kind === "probetraining" ? "" : `${label("Deine App")}
<p style="margin:0;font-size:14px;line-height:1.6;color:#d4d8d9">Lade dir schon jetzt unsere App von Technogym herunter, dann ist zum Onboarding alles startklar: <a href="${TECHNOGYM_APP}" style="color:#FBFF00">App herunterladen</a></p>`}
${label("Termin passt doch nicht?")}
<p style="margin:0;font-size:14px;line-height:1.6;color:#d4d8d9">Schreib Boris per <a href="${wa}" style="color:#FBFF00">WhatsApp ${WA_DISPLAY}</a> oder antworte auf diese Mail. Wir finden einen neuen Termin.</p>`,
    `${when}, ${hours}: dein ${c.label} bei SKILL CGN.`);
  const text = [`Termin steht, ${first(o.name)}.`, "", `${c.label}: ${when}, ${hours}`, `Mit ${o.coach}, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.`, "",
    `In Google Kalender: ${o.google}`, `Apple / Outlook: ${o.ics}`, "",
    `Das erwartet dich (${o.minutes} Minuten mit deinem Coach):`, ...c.expect.map(([t, d], i) => `${i + 1}. ${t}: ${d}`), `Mitbringen: ${MITBRINGEN}`, "",
    ...(o.kind === "probetraining" ? [] : [`Deine App: Lade dir unsere App von Technogym herunter: ${TECHNOGYM_APP}`, ""]),
    `Termin passt doch nicht? WhatsApp ${WA_DISPLAY} oder auf diese Mail antworten.`, "", `SKILL CGN · Herzogstraße 16–20 · 50667 Köln · ${SITE.replace(/^https?:\/\//, "")}`].join("\n");
  return { subject: `Dein ${c.label}: ${day(o.start)}, ${time(o.start)} Uhr`, html, text };
}

/** Nur die Kundenmail (auch zum erneuten Zusenden, wenn jemand mit derselben E-Mail noch einmal buchen will). */
export async function sendOnboardingCustomerMail(o: OnboardingMail): Promise<boolean> {
  const c = COPY[o.kind || "onboarding"];
  const m = onboardingCustomerMail(o);
  return sendFrom(CHECKOUT_FROM, o.email, m.subject, m.html, { replyTo: STAFF_EMAIL, text: m.text }).then(Boolean).catch(e => { console.log(`${c.label} mail kunde`, String(e)); return false; });
}

export async function sendOnboardingMails(o: OnboardingMail) {
  const c = COPY[o.kind || "onboarding"];
  const customer = await sendOnboardingCustomerMail(o);
  const rows: [string, string][] = [["Wann", `${day(o.start)}, ${time(o.start)} bis ${time(o.end)} Uhr`], ["Coach", o.coachFull], ["Kunde", o.name], ["E-Mail", o.email], ["Telefon", o.phone || "keine Angabe"], [o.kind === "probetraining" ? "Info" : "Angebot", o.offer || "keine Angabe"]];
  /* Termin ohne sicheren Coach zur selben Zeit: der Coach ist frei gerechnet, aber wer den anderen Termin macht, steht nicht im Kalender */
  const check = o.uncertain?.length ? `Bitte prüfen: Zur selben Zeit steht ohne sicheren Coach im Kalender: ${o.uncertain.join(", ")}. Falls ${o.coach} den macht, übernimmt ein anderer Coach das ${c.label}. Tipp: Coach als Gast eintragen, dann ist es eindeutig.` : "";
  const staffHtml = wrap(`<h1 style="font-size:28px;margin:0 0 12px">${c.label} gebucht</h1><table style="border-collapse:collapse;color:#fff;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#9aa3a6">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>${check ? `<p style="margin:16px 0 0;padding:12px 14px;border-left:6px solid #FBFF00;background:#2A3133;font-size:14px;color:#fff">${esc(check)}</p>` : ""}<p style="margin-top:16px;font-size:14px;color:#d4d8d9">Steht im Kalender "${c.calendarName}". Gebucht über die Website.</p>`);
  const staff = await sendFrom(CHECKOUT_FROM, STAFF_EMAIL, `${o.uncertain?.length ? "Bitte prüfen: " : ""}${c.label} gebucht: ${o.name}, ${day(o.start)} ${time(o.start)} (${o.coach})`, staffHtml, { text: [...rows.map(([k, v]) => `${k}: ${v}`), check].filter(Boolean).join("\n") }).then(Boolean).catch(e => { console.log(`${c.label} mail team`, String(e)); return false; });
  return { customer, staff };
}
