/* Tagesbericht Verkauf (sales-report.mts): aus den Checkout-Datensätzen (checkout-leads), die es ohnehin gibt. Zählt unabhängig von Cookies:
   Schritt 1 abgeschickt (Kontaktdaten) → Zahlungsschritt erreicht → Vertrag, dazu Erinnerungsmails und Quellen je Aktion.
   Reine Funktion ohne Speicher und Mail, damit sie sich testen lässt. Keine Namen im Bericht, nur Vertragsnummern. */
import type { CheckoutLead } from "./store";
import { F_MONO } from "./notify";

const H = 3600000;
const BERLIN_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
export const dayOf = (iso?: string) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? BERLIN_DAY.format(new Date(t)) : ""; };
const label = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const short = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

/* Kanal aus Hostname oder Android-Paket: dieselben Regeln wie channelOf in src/lib/events.ts (für alte Einträge "Referrer <host>") */
function channelOf(host: string, app: boolean): string {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (/^com\.google\.android\.(googlequicksearchbox|apps\.maps)$/.test(h)) return "Google Suche/Maps";
  if (h === "com.google.android.gm" || h === "mail.google.com") return "E-Mail (Gmail)";
  if (h === "com.google.android.apps.messaging") return "SMS";
  if (h === "com.google.android.youtube" || /(^|\.)youtube\.com$/.test(h)) return "YouTube";
  if (/^com\.instagram\./.test(h) || /(^|\.)instagram\.com$/.test(h)) return "Instagram";
  if (/^com\.facebook\./.test(h) || /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(h)) return "Facebook";
  if (/^com\.whatsapp/.test(h) || /(^|\.)whatsapp\.com$/.test(h)) return "WhatsApp";
  if (/^(com\.zhiliaoapp\.musically|com\.ss\.android\.)/.test(h) || /(^|\.)tiktok\.com$/.test(h)) return "TikTok";
  if (/^(maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h)) return "Google Suche/Maps";
  if (h === "skill-studios.com" || h.endsWith(".skill-studios.com")) return "intern";
  return (app ? "App " : "Referrer ") + h;
}
/* Quelle gruppieren: ohne "Einstieg …" und Erinnerungsmail; alte Einträge "Referrer l.instagram.com" auf den Kanal abbilden */
export function sourceGroup(utm?: string): string {
  let s = String(utm || "").split(" · ").filter(p => !/^Einstieg |Erinnerungsmail/.test(p)).join(" · ").trim();
  const ref = /^Referrer (\S+)$/.exec(s)?.[1];
  /* Altes Format: Android-Apps kamen als Paketname (com.google.android.gm), Webseiten als Hostname */
  if (ref) s = channelOf(ref, /^com\.[a-z0-9_]+\.[a-z0-9_.]+$/.test(ref.toLowerCase()) && !/\.(com|de|net|org)$/.test(ref.toLowerCase()));
  return s || "unbekannt";
}
/* Aktion für den Bericht: /checkout (Mitgliedschaften) läuft im Datensatz unter START 39 (Erinnerungslink, Meta), zählt hier aber als eigenes Angebot.
   Alte Datensätze ohne page: START 39 mit Laufzeit (months) kam von /checkout, START 39 selbst hat keine Laufzeitwahl. */
export function campaignOf(l: Pick<CheckoutLead, "campaign" | "page" | "offer" | "months">): string {
  if (l.page === "/checkout") return l.offer || "Mitgliedschaft (/checkout)";
  if (!l.page && l.campaign === "START 39" && l.months) return "Mitgliedschaft (/checkout)";
  return l.campaign || "unbekannt";
}

/* Wie weit kam jemand? Schritt 1 = Datensatz existiert. Zahlungsschritt: Vertrag, Abbruch in Schritt 3, Kartendaten oder Stripe. */
export const reachedPayment = (l: CheckoutLead) => !!l.done || Math.max(l.maxStep || 0, l.abandonedStep || 0) >= 3 || !!l.card || !!l.stripe || !!l.express;
/* Abschlusszeit: doneAt (neu), sonst die Zeit der Vertragsmail, Stripe-Zahlung oder Meta-Meldung, zuletzt Schritt 1 */
export const doneTime = (l: CheckoutLead): string | undefined => !l.done || !l.contractId ? undefined
  : l.doneAt || (l as any).mails?.at || l.stripe?.paidAt || l.capi?.at || l.createdAt;
const metaStatus = (l: CheckoutLead): { key: "sent" | "consent" | "token" | "other" | "unknown"; text: string } => {
  /* Nur was der Server getan hat. Der Browser meldet den Kauf zusätzlich, wenn auf der Dankeseite zugestimmt wird. */
  if (l.capi?.sent) return { key: "sent", text: "per Server an Meta gemeldet" };
  const n = l.capi?.note || "";
  if (/Cookie-Zustimmung/.test(n)) return { key: "consent", text: "nicht per Server an Meta (keine Cookie-Zustimmung)" };
  if (/META_CAPI_TOKEN/.test(n)) return { key: "token", text: "nicht per Server an Meta (META_CAPI_TOKEN fehlt)" };
  if (l.capi) return { key: "other", text: `nicht per Server an Meta (${n.slice(0, 60) || "Fehler"})` };
  return { key: "unknown", text: "Meta-Meldung unbekannt" };
};

export interface Counts { starts: number; payment: number; contracts: number; reminders: number; recovered: number }
export interface CampaignReport { campaign: string; since: string; yesterday: Counts; total: Counts; sources: { source: string; starts: number; contracts: number }[];
  meta: { sent: number; consent: number; token: number; other: number; unknown: number } }
export interface SalesReport { day: string; hasData: boolean; subject: string; html: string; text: string; tests: number;
  summary: { day: string; createdAt: string; tests: number; campaigns: CampaignReport[] }; contractsYesterday: { campaign: string; at: string; contractId: string; payment: string; source: string; meta: string }[] }

const zero = (): Counts => ({ starts: 0, payment: 0, contracts: 0, reminders: 0, recovered: 0 });

/** Tests: "test" am Wortanfang in Name oder E-Mail (Tester, info+test@), eigene Domain, oder REPORT_IGNORE_EMAILS in Netlify */
export function testFilter(ignoreEmails: string[] = []) {
  const ignore = new Set(ignoreEmails.map(e => e.trim().toLowerCase()).filter(Boolean));
  return (l: CheckoutLead) => /(^|[^a-zäöüß])test/i.test(`${l.firstName} ${l.lastName} ${l.email}`) || /@(.+\.)?skill-studios\.com$/i.test(l.email || "") || ignore.has((l.email || "").toLowerCase());
}

/* Eine Aktion über einen Zeitraum (SKILLTOOL2-Dashboard): dieselben Regeln wie der Tagesbericht. Formulare und Zahlungsschritt nach Tag von
   Schritt 1, Verträge nach Abschlusstag. Keine Namen, nur Vertragsnummer, Tag und Quelle. */
export interface DayStats { date: string; starts: number; payment: number; contracts: number }
export interface CampaignStats { starts: number; payment: number; contracts: number; days: DayStats[]; contractList: { date: string; contractId: string; source: string }[];
  sources: { source: string; starts: number; contracts: number }[]; tests: number }
export function campaignStats(leads: CheckoutLead[], campaign: string, opts: { from?: string; to?: string; ignoreEmails?: string[] } = {}): CampaignStats {
  const isTest = testFilter(opts.ignoreEmails);
  const inRange = (d: string) => !!d && (!opts.from || d >= opts.from) && (!opts.to || d <= opts.to);
  const mine = leads.filter(l => campaignOf(l) === campaign);
  const list = mine.filter(l => !isTest(l));
  const days = new Map<string, DayStats>(), src = new Map<string, { starts: number; contracts: number }>();
  const day = (d: string) => { let x = days.get(d); if (!x) { x = { date: d, starts: 0, payment: 0, contracts: 0 }; days.set(d, x); } return x; };
  const out: CampaignStats = { starts: 0, payment: 0, contracts: 0, days: [], contractList: [], sources: [], tests: mine.length - list.length };
  for (const l of list) {
    const created = dayOf(l.createdAt), doneAt = doneTime(l), done = dayOf(doneAt), g = sourceGroup(l.utm);
    const s = src.get(g) || { starts: 0, contracts: 0 };
    if (inRange(created)) { out.starts++; day(created).starts++; s.starts++; if (reachedPayment(l)) { out.payment++; day(created).payment++; } }
    if (doneAt && inRange(done)) { out.contracts++; day(done).contracts++; s.contracts++; out.contractList.push({ date: done, contractId: l.contractId || "—", source: g }); }
    if (s.starts || s.contracts) src.set(g, s);
  }
  out.days = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  out.contractList.sort((a, b) => a.date.localeCompare(b.date) || a.contractId.localeCompare(b.contractId));
  out.sources = [...src].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.contracts - a.contracts || b.starts - a.starts || a.source.localeCompare(b.source));
  return out;
}

export function buildSalesReport(leads: CheckoutLead[], now = new Date(), opts: { ignoreEmails?: string[] } = {}): SalesReport {
  const day = dayOf(new Date(now.getTime() - 24 * H).toISOString()); // gestern in Köln
  const isTest = testFilter(opts.ignoreEmails);
  const real = leads.filter(l => !isTest(l));
  const tests = leads.length - real.length;

  const byCampaign = new Map<string, CheckoutLead[]>();
  for (const l of real) { const k = campaignOf(l); byCampaign.set(k, [...(byCampaign.get(k) || []), l]); }
  const contractsYesterday: SalesReport["contractsYesterday"] = [];
  const campaigns: CampaignReport[] = [];
  for (const [campaign, list] of byCampaign) {
    const r: CampaignReport = { campaign, since: list.map(l => dayOf(l.createdAt)).filter(Boolean).sort()[0] || day, yesterday: zero(), total: zero(), sources: [], meta: { sent: 0, consent: 0, token: 0, other: 0, unknown: 0 } };
    const src = new Map<string, { starts: number; contracts: number }>();
    for (const l of list) {
      const created = dayOf(l.createdAt), doneAt = doneTime(l), done = dayOf(doneAt), mailed = dayOf(l.mailedAt);
      const recovered = !!doneAt && !!l.mailedAt && Date.parse(doneAt) > Date.parse(l.mailedAt);
      const g = sourceGroup(l.utm); const s = src.get(g) || { starts: 0, contracts: 0 };
      s.starts++; r.total.starts++;
      if (reachedPayment(l)) r.total.payment++;
      if (l.mailedAt) r.total.reminders++;
      if (doneAt) { s.contracts++; r.total.contracts++; r.meta[metaStatus(l).key]++; if (recovered) r.total.recovered++; }
      src.set(g, s);
      if (created === day) { r.yesterday.starts++; if (reachedPayment(l)) r.yesterday.payment++; }
      if (mailed === day) r.yesterday.reminders++;
      if (doneAt && done === day) {
        r.yesterday.contracts++; if (recovered) r.yesterday.recovered++;
        contractsYesterday.push({ campaign, at: doneAt, contractId: l.contractId || "—", payment: l.stripe || l.card ? (l.express ? "Wallet (Stripe)" : "Karte (Stripe)") : "SEPA",
          source: (l.utm || "unbekannt") + (recovered && !/Erinnerungsmail/.test(l.utm || "") ? " · nach Erinnerungsmail" : ""), meta: metaStatus(l).text });
      }
    }
    r.sources = [...src].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.contracts - a.contracts || b.starts - a.starts || a.source.localeCompare(b.source));
    campaigns.push(r);
  }
  /* Aktive Aktionen zuerst: gestern etwas los, dann nach Verträgen gesamt */
  campaigns.sort((a, b) => (b.yesterday.starts + b.yesterday.contracts) - (a.yesterday.starts + a.yesterday.contracts) || b.total.contracts - a.total.contracts || b.total.starts - a.total.starts);
  contractsYesterday.sort((a, b) => a.at.localeCompare(b.at));

  const y = campaigns.reduce((s, c) => ({ starts: s.starts + c.yesterday.starts, contracts: s.contracts + c.yesterday.contracts }), { starts: 0, contracts: 0 });
  const subject = `Verkauf gestern (${label(day)}): ${y.contracts} ${y.contracts === 1 ? "Vertrag" : "Verträge"}, ${y.starts} ${y.starts === 1 ? "Formular" : "Formulare"} gestartet`;

  const td = "padding:6px 10px;border-bottom:1px solid #2A3133";
  const num = `${td};text-align:right;font-family:${F_MONO}`;
  const head = (t: string) => `<p style="margin:26px 0 8px;font-family:${F_MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FBFF00">${t}</p>`;
  const block = (c: CampaignReport) => {
    /* Drei Spalten, Quote klein unter der Bezeichnung: passt auch auf dem Handy */
    const row = (name: string, a: number, b: number, extra = "") => `<tr><td style="${td}">${name}${extra ? `<br><span style="color:#9aa3a6;font-size:12px">${extra}</span>` : ""}</td><td style="${num}">${a}</td><td style="${num}">${b}</td></tr>`;
    const srcRows = c.sources.slice(0, 8).map(s => `<tr><td style="${td}">${esc(s.source)}</td><td style="${num}">${s.starts}</td><td style="${num}">${s.contracts}</td></tr>`).join("");
    const rest = c.sources.slice(8).reduce((a, s) => ({ starts: a.starts + s.starts, contracts: a.contracts + s.contracts }), { starts: 0, contracts: 0 });
    const m = c.meta, mTotal = m.sent + m.consent + m.token + m.other + m.unknown;
    const metaLine = !mTotal ? "" : `<p style="margin:10px 0 0;font-size:13px;color:#d4d8d9">Meta per Server: ${m.sent} von ${mTotal} Verträgen gemeldet${m.consent ? `, ${m.consent} ohne Cookie-Zustimmung` : ""}${m.other ? `, ${m.other} mit Fehler` : ""}${m.unknown ? `, ${m.unknown} unbekannt` : ""}.</p>`
      + (m.token ? `<p style="margin:8px 0 0;padding:10px 12px;border:2px solid #FBFF00;color:#FBFF00;font-size:13px">META_CAPI_TOKEN fehlt in Netlify: ${m.token} ${m.token === 1 ? "Kauf ging" : "Käufe gingen"} nicht vom Server an Meta.</p>` : "");
    return `<h2 style="margin:30px 0 6px;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:30px;letter-spacing:0.5px;color:#fff">${esc(c.campaign)}</h2>
<table style="border-collapse:collapse;color:#fff;font-size:14px;width:100%">
<tr><td style="${td};color:#9aa3a6"></td><td style="${num};color:#9aa3a6;white-space:nowrap">Gestern</td><td style="${num};color:#9aa3a6;white-space:nowrap">seit ${short(c.since)}</td></tr>
${row("Formular gestartet", c.yesterday.starts, c.total.starts)}
${row("Bis zur Zahlung", c.yesterday.payment, c.total.payment, `${pct(c.total.payment, c.total.starts)} der Formulare`)}
${row("<strong>Verträge</strong>", c.yesterday.contracts, c.total.contracts, `${pct(c.total.contracts, c.total.starts)} der Formulare`)}
${row("Erinnerungsmails", c.yesterday.reminders, c.total.reminders)}
${row("Danach abgeschlossen", c.yesterday.recovered, c.total.recovered)}
</table>
${head(`Quellen seit ${short(c.since)}`)}
<table style="border-collapse:collapse;color:#fff;font-size:13px;width:100%">
<tr><td style="${td};color:#9aa3a6">Quelle</td><td style="${num};color:#9aa3a6">Formulare</td><td style="${num};color:#9aa3a6">Verträge</td></tr>
${srcRows}${c.sources.length > 8 ? `<tr><td style="${td};color:#9aa3a6">${c.sources.length - 8} weitere</td><td style="${num}">${rest.starts}</td><td style="${num}">${rest.contracts}</td></tr>` : ""}
</table>${metaLine}`;
  };
  const list = contractsYesterday.length ? `${head("Verträge gestern")}<table style="border-collapse:collapse;color:#fff;font-size:13px;width:100%">${contractsYesterday.map(c =>
    `<tr><td style="${td};font-family:${F_MONO};white-space:nowrap">${time(c.at)}</td><td style="${td}">${esc(c.campaign)}, Vertrag ${esc(c.contractId)}, ${c.payment}<br><span style="color:#9aa3a6">${esc(c.source)} · ${esc(c.meta)}</span></td></tr>`).join("")}</table>` : "";
  const html = `<h1 style="font-size:34px;margin:0 0 6px">Verkauf gestern</h1>
<p style="margin:0;font-family:${F_MONO};font-size:12px;letter-spacing:1px;color:#9aa3a6">${label(day)} · ${y.contracts} ${y.contracts === 1 ? "Vertrag" : "Verträge"} · ${y.starts} ${y.starts === 1 ? "Formular" : "Formulare"}</p>
${campaigns.map(block).join("")}
${list}
<p style="margin:28px 0 0;font-size:12px;color:#9aa3a6">Gezählt wird ab dem abgeschickten Schritt 1, unabhängig von Cookies. Besuche ohne Formular zählt dieser Bericht nicht.
Verträge laut Website, maßgeblich bleibt Magicline. ${tests ? `${tests} ${tests === 1 ? "Testeintrag" : "Testeinträge"} (Name oder E-Mail mit „test“, eigene Domain) nicht mitgezählt.` : ""}
Daten der letzten 30 Tage.</p>`;
  const text = [`Verkauf gestern (${label(day)}): ${y.contracts} Verträge, ${y.starts} Formulare`, ...campaigns.map(c =>
    `${c.campaign}: gestern ${c.yesterday.starts} Formulare, ${c.yesterday.payment} bis Zahlung, ${c.yesterday.contracts} Verträge. Seit ${short(c.since)}: ${c.total.starts} / ${c.total.payment} / ${c.total.contracts}. Quellen: ${c.sources.slice(0, 5).map(s => `${s.source} ${s.starts}/${s.contracts}`).join("; ")}`)].join("\n");
  return { day, hasData: real.length > 0, subject, html, text, tests, contractsYesterday,
    summary: { day, createdAt: now.toISOString(), tests, campaigns } };
}
