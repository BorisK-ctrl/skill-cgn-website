/*
 * Wunschtermin für Onboarding (90 Min) und Probetraining (30 Min). Boris, 19.11.2026: "integrierter Kalender zur Auswahl, nicht über WhatsApp",
 * dann "genauso fürs Probetraining".
 * Gilt, solange der Website-Kalender keinen Google-Zugang hat oder Google gerade nicht antwortet: Der Kunde wählt Tag und Uhrzeit im Kalender
 * auf der Seite, das Team bekommt die Anfrage per Mail und bestätigt. Es entsteht kein Kalendereintrag, deshalb kollidiert nichts mit euren
 * Terminen. Mit Google-Zugang zeigt derselbe Kalender echte freie Zeiten und bucht sofort (lib/booking.ts).
 * Uhrzeiten: wann es laut den echten Schichten geht (Auswertung SERVICE, Classes, Termine vom 19.11. bis 10.12.2026, beim Probetraining nur
 * Zeiten, die in mindestens zwei von drei Wochen frei waren). Ändern: PLAN unten.
 */
import { berlinToDate, berlinDate, berlinTime, addDays, STAFF_EMAIL } from "./util";
import { wrap, sendFrom, CHECKOUT_FROM, F_DISPLAY, F_MONO, F_TEXT } from "./notify";
import { ONBOARDING_EXPECT } from "./welcome";
import { MITBRINGEN, TECHNOGYM_APP, PROBE_EXPECT } from "./onboarding-mail";

export type AnfrageKind = "onboarding" | "probetraining";
const H = 3600000;
interface Plan { label: string; minutes: number; showLeadMs: number; acceptLeadMs: number; week: Record<number, string[]> }
/** Wochentag (1 = Montag … 5 = Freitag) → Startzeiten in Köln. showLeadMs: angezeigt ab (Zeit zum Bestätigen), acceptLeadMs: angenommen ab
 *  (die Seite kann länger offen gewesen sein). */
const PLAN: Record<AnfrageKind, Plan> = {
  onboarding: { label: "Onboarding", minutes: 90, showLeadMs: 30 * H, acceptLeadMs: 12 * H, week: {
    1: ["09:00", "09:30", "10:00"],
    2: ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
    3: ["14:00", "14:30", "15:00"],
    4: ["09:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
    5: ["09:00", "09:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
  } },
  probetraining: { label: "Probetraining", minutes: 30, showLeadMs: 24 * H, acceptLeadMs: 6 * H, week: {
    1: ["09:00", "09:30", "10:00", "10:30", "11:00", "13:30"],
    2: ["10:00", "11:30", "13:00", "13:30", "14:30", "15:00", "15:30", "16:00", "16:30", "19:00"],
    3: ["09:00", "09:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "17:30"],
    4: ["09:00", "09:30", "10:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "18:30", "19:00"],
    5: ["09:00", "09:30", "10:00", "10:30", "13:00", "13:30"],
  } },
};
export const ANFRAGE_MIN = PLAN.onboarding.minutes;
export const anfrageMinutes = (kind: AnfrageKind = "onboarding") => PLAN[kind].minutes;
const CLOSED = new Set(["12-24", "12-25", "12-26", "12-31", "01-01"]); // Jahreswechsel
const HORIZON_DAYS = 21;

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
const timesFor = (date: string, kind: AnfrageKind) => (CLOSED.has(date.slice(5)) ? [] : PLAN[kind].week[weekday(date)] || []);

export interface Span { start: string; end: string }
/** Wählbare Wunschtermine der nächsten drei Wochen, je Tag (YYYY-MM-DD in Köln). */
export function anfrageByDay(now = new Date(), kind: AnfrageKind = "onboarding"): Record<string, Span[]> {
  const p = PLAN[kind], out: Record<string, Span[]> = {};
  const today = berlinDate(now);
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    const list = timesFor(date, kind).map(t => berlinToDate(date, t)).filter(d => d.getTime() - now.getTime() >= p.showLeadMs)
      .map(d => ({ start: d.toISOString(), end: new Date(d.getTime() + p.minutes * 60000).toISOString() }));
    if (list.length) out[date] = list;
  }
  return out;
}
/** Start einer Anfrage prüfen: Zeit aus dem Wochenplan, kein geschlossener Tag, Vorlauf bis 22 Tage voraus. null = nicht wählbar. */
export function anfrageStart(iso: unknown, now = new Date(), kind: AnfrageKind = "onboarding"): Date | null {
  const d = new Date(String(iso ?? ""));
  if (isNaN(d.getTime())) return null;
  const date = berlinDate(d), time = berlinTime(d);
  if (!timesFor(date, kind).includes(time) || berlinToDate(date, time).getTime() !== d.getTime()) return null;
  const ahead = d.getTime() - now.getTime();
  return ahead >= PLAN[kind].acceptLeadMs && ahead <= (HORIZON_DAYS + 1) * 86400000 ? d : null;
}

export interface Anfrage { kind?: AnfrageKind; name: string; email: string; phone: string; start: string; end: string; note?: string; contract?: string; offer?: string; verified: boolean; plz?: string; usc?: string; earlier?: string }

const esc = (t: string) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
const dayShort = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const first = (name: string) => name.trim().split(/\s+/)[0] || "";
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const label = (t: string) => `<p style="margin:26px 0 8px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9aa3a6">${t}</p>`;

/** Ein Klick fürs Team: Termin in Google Kalender anlegen (passenden Kalender wählen) und Bestätigung an den Kunden vorschreiben. */
export function teamLinks(a: Anfrage) {
  const p = PLAN[a.kind || "onboarding"];
  const details = [a.name, a.phone, a.email, a.contract ? `Vertrag ${a.contract}` : "", a.plz ? `PLZ ${a.plz}` : "", a.usc ? `Urban Sports Club: ${a.usc}` : "", a.note ? `Anmerkung: ${a.note}` : "", "Wunschtermin über die Website"].filter(Boolean).join("\n");
  const calendar = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${p.label} ${a.name}`)}&dates=${stamp(a.start)}/${stamp(a.end)}&location=${encodeURIComponent("SKILL CGN, Herzogstraße 16-20, 50667 Köln")}&details=${encodeURIComponent(details)}`;
  const body = `Hi ${first(a.name)},\n\ndein ${p.label} steht: ${day(a.start)}, ${time(a.start)} bis ${time(a.end)} Uhr, bei uns in der Herzogstraße 16–20, zwei Minuten vom Neumarkt.\n\nMitbringen: ${MITBRINGEN}\n\nBis bald\nSKILL CGN`;
  const confirm = `mailto:${encodeURIComponent(a.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Dein ${p.label}: ${day(a.start)}, ${time(a.start)} Uhr`)}&body=${encodeURIComponent(body)}`;
  return { calendar, confirm };
}

/** Anfrage ans Team (info@). Antworten gehen direkt an den Kunden. */
export async function sendAnfrageTeam(a: Anfrage): Promise<boolean> {
  const kind = a.kind || "onboarding", p = PLAN[kind];
  const { calendar, confirm } = teamLinks(a);
  const rows: [string, string][] = [
    ["Wunschtermin", `${day(a.start)}, ${time(a.start)} bis ${time(a.end)} Uhr`],
    ["Kunde", a.name], ["E-Mail", a.email], ["Telefon", a.phone || "keine Angabe"],
    ...(kind === "onboarding"
      ? [["Vertrag", a.contract ? `${a.contract}${a.verified ? " (laut Kauf auf der Website, bitte in Magicline prüfen)" : " (Angabe des Kunden, bitte prüfen)"}` : "nicht angegeben, Mitgliedschaft bitte prüfen"] as [string, string]]
      : [["PLZ", a.plz || "keine Angabe"] as [string, string], ["Urban Sports Club", a.usc || "keine Angabe"] as [string, string]]),
    ...(a.offer ? [["Angebot", a.offer] as [string, string]] : []),
    ...(a.note ? [["Anmerkung", a.note] as [string, string]] : []),
    ...(a.earlier ? [["Frühere Anfrage", a.earlier] as [string, string]] : []),
  ];
  const btn = (href: string, text: string) => `<td style="padding:0 8px 8px 0"><a href="${esc(href)}" style="display:inline-block;padding:12px 14px;border:2px solid #FBFF00;font-family:${F_TEXT};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FBFF00;text-decoration:none">${text}</a></td>`;
  const html = wrap(`<p style="margin:0 0 10px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FBFF00">Wunschtermin von der Website</p>
<h1 style="font-size:30px;margin:0 0 14px">${p.label}-Anfrage</h1>
<table style="border-collapse:collapse;color:#fff;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#9aa3a6;vertical-align:top">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<p style="margin:16px 0 0;padding:12px 14px;border-left:6px solid #FBFF00;background:#2A3133;font-size:14px;line-height:1.5;color:#fff">Steht noch nicht im Kalender. Bitte Coach finden, im Kalender ${p.label} eintragen und dem Kunden bestätigen. Wenn ihr auf diese Mail antwortet, geht die Antwort direkt an den Kunden. Passt die Zeit nicht, schlagt ihm die nächste freie vor.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr>${btn(calendar, "In Kalender eintragen")}${btn(confirm, "Bestätigung schreiben")}</tr></table>`, `${a.name}: ${dayShort(a.start)}, ${time(a.start)} Uhr`);
  const text = [`${p.label}-Anfrage (Wunschtermin von der Website, steht noch nicht im Kalender)`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "",
    `Bitte Coach finden, im Kalender ${p.label} eintragen und dem Kunden bestätigen. Antworten auf diese Mail gehen direkt an den Kunden.`, "", `In Kalender eintragen: ${calendar}`].join("\n");
  return sendFrom(CHECKOUT_FROM, STAFF_EMAIL, `${p.label}-Anfrage: ${a.name}, ${dayShort(a.start)} ${time(a.start)} Uhr, bitte bestätigen`, html, { replyTo: a.email, text, logLabel: `${kind}-anfrage team` });
}

/** Eingangsbestätigung an den Kunden: Wunschtermin, Bestätigung folgt innerhalb von 24 Stunden. */
export async function sendAnfrageKunde(a: Anfrage): Promise<boolean> {
  const kind = a.kind || "onboarding", p = PLAN[kind];
  const expect = kind === "onboarding" ? ONBOARDING_EXPECT : PROBE_EXPECT;
  const step = (n: number, t: string) => `<tr><td width="38" valign="top" style="padding:8px 0;font-family:${F_DISPLAY};font-size:28px;line-height:1;color:#FBFF00">0${n}</td><td style="padding:8px 0;font-family:${F_TEXT};font-size:15px;line-height:1.5;color:#d4d8d9">${t}</td></tr>`;
  const app = kind === "onboarding" ? `${label("Deine App")}
<p style="margin:0;font-size:14px;line-height:1.6;color:#d4d8d9">Lade dir schon jetzt unsere App von Technogym herunter, dann ist zum Onboarding alles startklar: <a href="${TECHNOGYM_APP}" style="color:#FBFF00">App herunterladen</a></p>` : "";
  const html = wrap(`<p style="margin:0 0 14px;font-family:${F_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FBFF00">${p.label} angefragt</p>
<h1 style="margin:0 0 18px;font-family:${F_DISPLAY};font-weight:400;font-size:46px;line-height:0.95;text-transform:uppercase;color:#fff">Anfrage ist da,<br><span style="color:#FBFF00">${esc(first(a.name))}.</span></h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A3133;border-left:6px solid #FBFF00"><tr><td style="padding:16px 20px;font-family:${F_TEXT};font-size:15px;line-height:1.55;color:#fff">
<span style="font-family:${F_MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9aa3a6">Dein Wunschtermin</span><br>
<span style="font-family:${F_MONO};font-size:17px;color:#FBFF00">${day(a.start)}<br>${time(a.start)} bis ${time(a.end)} Uhr</span><br>
<span style="color:#d4d8d9">Wir schauen, welcher Coach Zeit hat, und bestätigen dir den Termin innerhalb von 24 Stunden per Mail. Passt die Zeit nicht, schlagen wir dir die nächste freie vor.</span></td></tr></table>
${label("Das erwartet dich")}
<p style="margin:0 0 6px;font-size:14px;color:#d4d8d9">${p.minutes} Minuten mit deinem Coach, bei uns in der Herzogstraße 16–20, zwei Minuten vom Neumarkt.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${expect.map(([t, d], i) => step(i + 1, `<strong style="color:#fff">${t}</strong><br>${d}`)).join("")}</table>
<p style="margin:10px 0 0;padding:12px 14px;border:1px solid #3a4245;font-size:14px;color:#d4d8d9"><strong style="color:#fff">Mitbringen:</strong> ${MITBRINGEN}</p>
${app}
${label("Fragen?")}
<p style="margin:0;font-size:14px;line-height:1.6;color:#d4d8d9">Antworte einfach auf diese Mail.</p>`, `Wunschtermin ${dayShort(a.start)}, ${time(a.start)} Uhr: Bestätigung folgt innerhalb von 24 Stunden.`);
  const text = [`Anfrage ist da, ${first(a.name)}.`, "", `Dein Wunschtermin (${p.label}): ${day(a.start)}, ${time(a.start)} bis ${time(a.end)} Uhr`,
    "Wir schauen, welcher Coach Zeit hat, und bestätigen dir den Termin innerhalb von 24 Stunden per Mail. Passt die Zeit nicht, schlagen wir dir die nächste freie vor.", "",
    `Das erwartet dich (${p.minutes} Minuten mit deinem Coach):`, ...expect.map(([t, d], i) => `${i + 1}. ${t}: ${d}`), `Mitbringen: ${MITBRINGEN}`, "",
    ...(kind === "onboarding" ? [`Deine App: ${TECHNOGYM_APP}`, ""] : []), "Fragen? Antworte einfach auf diese Mail.", "", "SKILL CGN · Herzogstraße 16–20 · 50667 Köln"].join("\n");
  return sendFrom(CHECKOUT_FROM, a.email, `Deine ${p.label}-Anfrage: ${day(a.start)}, ${time(a.start)} Uhr`, html, { replyTo: STAFF_EMAIL, text, logLabel: `${kind}-anfrage kunde` });
}
