/* Tagesbericht Verkauf (sales-report.mts): aus den Checkout-Datensätzen (checkout-leads), die es ohnehin gibt. Zählt unabhängig von Cookies:
   Schritt 1 abgeschickt (Kontaktdaten) → Zahlungsschritt erreicht → Vertrag, dazu Erinnerungsmails und Quellen je Aktion.
   Reine Funktion ohne Speicher und Mail, damit sie sich testen lässt. Keine Namen im Bericht, nur Vertragsnummern. */
import type { CheckoutLead } from "./store";
import { F_MONO } from "./notify";

const H = 3600000;
const BERLIN_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = (iso?: string) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? BERLIN_DAY.format(new Date(t)) : ""; };
const label = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const short = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

/* Quelle gruppieren: ohne "Einstieg …" und Erinnerungsmail; alte Einträge "Referrer l.instagram.com" auf den Kanal abbilden */
export function sourceGroup(utm?: string): string {
  let s = String(utm || "").split(" · ").filter(p => !/^Einstieg |Erinnerungsmail/.test(p)).join(" · ").trim();
  const ref = /^Referrer (\S+)$/.exec(s)?.[1]?.replace(/^www\./, "");
  if (ref) {
    if (/(^|\.)instagram\.com$/.test(ref)) s = "Instagram";
    else if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(ref)) s = "Facebook";
    else if (/(^|\.)google\.[a-z.]+$/.test(ref)) s = "Google Suche/Maps";
    else if (ref === "skill-studios.com" || ref.endsWith(".skill-studios.com")) s = "intern";
  }
  return s || "unbekannt";
}

/* Wie weit kam jemand? Schritt 1 = Datensatz existiert. Zahlungsschritt: Vertrag, Abbruch in Schritt 3, Kartendaten oder Stripe. */
const reachedPayment = (l: CheckoutLead) => !!l.done || l.abandonedStep === 3 || !!l.card || !!l.stripe || !!l.express;
/* Abschlusszeit: doneAt (neu), sonst die Zeit der Vertragsmail, Stripe-Zahlung oder Meta-Meldung, zuletzt Schritt 1 */
const doneTime = (l: CheckoutLead): string | undefined => !l.done || !l.contractId ? undefined
  : l.doneAt || (l as any).mails?.at || l.stripe?.paidAt || l.capi?.at || l.createdAt;
const metaStatus = (l: CheckoutLead): { key: "sent" | "consent" | "token" | "other" | "unknown"; text: string } => {
  if (l.capi?.sent) return { key: "sent", text: "an Meta gemeldet" };
  const n = l.capi?.note || "";
  if (/Cookie-Zustimmung/.test(n)) return { key: "consent", text: "nicht an Meta (keine Cookie-Zustimmung)" };
  if (/META_CAPI_TOKEN/.test(n)) return { key: "token", text: "nicht an Meta (META_CAPI_TOKEN fehlt)" };
  if (l.capi) return { key: "other", text: `nicht an Meta (${n.slice(0, 60) || "Fehler"})` };
  return { key: "unknown", text: "Meta-Meldung unbekannt" };
};

export interface Counts { starts: number; payment: number; contracts: number; reminders: number; recovered: number }
export interface CampaignReport { campaign: string; since: string; yesterday: Counts; total: Counts; sources: { source: string; starts: number; contracts: number }[];
  meta: { sent: number; consent: number; token: number; other: number; unknown: number } }
export interface SalesReport { day: string; hasData: boolean; subject: string; html: string; text: string; tests: number;
  summary: { day: string; createdAt: string; tests: number; campaigns: CampaignReport[] }; contractsYesterday: { campaign: string; at: string; contractId: string; payment: string; source: string; meta: string }[] }

const zero = (): Counts => ({ starts: 0, payment: 0, contracts: 0, reminders: 0, recovered: 0 });

export function buildSalesReport(leads: CheckoutLead[], now = new Date(), opts: { ignoreEmails?: string[] } = {}): SalesReport {
  const day = dayOf(new Date(now.getTime() - 24 * H).toISOString()); // gestern in Köln
  const ignore = new Set((opts.ignoreEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean));
  /* Tests: "test" am Wortanfang in Name oder E-Mail (Tester, info+test@), eigene Domain, oder REPORT_IGNORE_EMAILS in Netlify */
  const isTest = (l: CheckoutLead) => /(^|[^a-zäöüß])test/i.test(`${l.firstName} ${l.lastName} ${l.email}`) || /@(.+\.)?skill-studios\.com$/i.test(l.email || "") || ignore.has((l.email || "").toLowerCase());
  const real = leads.filter(l => !isTest(l));
  const tests = leads.length - real.length;

  const byCampaign = new Map<string, CheckoutLead[]>();
  for (const l of real) { const k = l.campaign || "unbekannt"; byCampaign.set(k, [...(byCampaign.get(k) || []), l]); }
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
