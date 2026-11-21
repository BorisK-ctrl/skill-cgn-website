/* SKILLTOOL2: internes KPI-Dashboard (Auftrag Boris 21.11.2026). Zugang mit einem gemeinsamen Passwort, Sitzung als HMAC-Cookie.
   Geheimnisse nur in Netlify: SKILLTOOL2_PASSWORD, SKILLTOOL2_SECRET (mind. 32 Zeichen), SKILLTOOL2_API_TOKEN (mind. 32 Zeichen).
   Daten: echte Verträge und Trichter aus den Checkout-Datensätzen mit den Regeln des Tagesberichts (lib/sales-report.ts), plus Archiv,
   Werbezahlen, Plan und Notizen aus dem Blob "skilltool2-ads" (POST /api/skilltool2/ads bzw. /notes). Keine Personendaten. */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { campaignOf, dayOf, doneTime, reachedPayment, sourceGroup, isTestByRule, type CampaignStats, type DayStats } from "./sales-report";
import type { CheckoutLead } from "./store";

export const COOKIE = "st2";
export const COOKIE_DAYS = 30;
const env = () => ({ pw: process.env.SKILLTOOL2_PASSWORD || "", secret: process.env.SKILLTOOL2_SECRET || "", token: process.env.SKILLTOOL2_API_TOKEN || "" });
/** Eingerichtet: Passwort mit mindestens 16 Zeichen und Secret mit mindestens 32. Der API-Token ist optional (ohne ihn nur Eingabe über das Dashboard). */
export const configured = () => { const e = env(); return e.pw.length >= 16 && e.secret.length >= 32; };
/* Vergleich in konstanter Zeit: beide Seiten erst hashen, dann gleich lange Puffer vergleichen */
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
export const passwordOk = (pw: unknown) => configured() && typeof pw === "string" && pw.length <= 200 && same(pw, env().pw);

const sign = (exp: number) => createHmac("sha256", env().secret).update(`st2|${exp}`).digest("hex");
export function sessionCookie(now = Date.now()) {
  const exp = Math.floor(now / 1000) + COOKIE_DAYS * 86400;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
export function hasSession(req: Request, now = Date.now()): boolean {
  if (!configured()) return false;
  const raw = (req.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
  const m = /^(\d{9,11})\.([0-9a-f]{64})$/.exec(raw);
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp * 1000 <= now) return false;
  return timingSafeEqual(Buffer.from(m[2], "hex"), Buffer.from(sign(exp), "hex"));
}
export function hasApiToken(req: Request): boolean {
  const t = env().token;
  if (t.length < 32) return false;
  const m = /^Bearer\s+(\S{1,200})$/.exec(req.headers.get("authorization") || "");
  return !!m && same(m[1], t);
}

/* ---------- Kampagnen-Dokument (Blob) ---------- */
export interface Plan { name?: string; start?: string; ende?: string; budget_tag_meta?: number; budget_tag_google?: number; preis_monat?: number;
  cpa_gut?: number; cpa_ok?: number; cpa_abschalt?: number; cpa_schlecht?: number; meta_campaign_ids?: string[]; google_campaign_id?: string; checkout_campaign?: string }
export interface AdDay { date: string; meta?: number; google?: number; impressions?: number; reach?: number; link_clicks?: number; junk_clicks?: number; lpv?: number;
  purchases_meta?: number; purchases_test?: number; partial?: boolean; google_clicks?: number }
export interface Ad { name: string; id?: string; spend?: number; impressions?: number; reach?: number; link_clicks?: number; ctr?: number; cpc?: number; lpv?: number; purchases_meta?: number; status?: string }
export interface GoogleBlock { impressions?: number; clicks?: number; ctr?: number; cpc?: number; spend?: number; conversions?: number }
export interface Doc { campaign: string; stand?: string; plan?: Plan; days: AdDay[]; ads: Ad[]; google?: GoogleBlock; next?: string; open?: string[]; updatedAt?: string }

export const CAMPAIGN = /^[a-z0-9-]{2,32}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/* Kampagnen-Kürzel → Aktion in den Checkout-Datensätzen (lib/sales-report.ts campaignOf), falls der Plan sie nicht nennt */
const CHECKOUT_CAMPAIGN: Record<string, string> = { bw29: "BLACK WEEK 29" };
const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v: unknown) => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN; return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : undefined; };
const pick = <T extends object>(o: Record<string, unknown>, keys: string[], f: (v: unknown) => unknown): Partial<T> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in o) { const v = f(o[k]); if (v !== undefined && v !== "") out[k] = v; }
  return out as Partial<T>;
};
const DAY_NUMS = ["meta", "google", "impressions", "reach", "link_clicks", "junk_clicks", "lpv", "purchases_meta", "purchases_test", "google_clicks"];
const AD_NUMS = ["spend", "impressions", "reach", "link_clicks", "ctr", "cpc", "lpv", "purchases_meta"];
const GOOGLE_NUMS = ["impressions", "clicks", "ctr", "cpc", "spend", "conversions"];
const PLAN_NUMS = ["budget_tag_meta", "budget_tag_google", "preis_monat", "cpa_gut", "cpa_ok", "cpa_abschalt", "cpa_schlecht"];

/** Eingang (POST ads/notes) in das gespeicherte Dokument mischen: Tag ersetzt Tag (Datum), Anzeige ersetzt Anzeige (id, sonst Name), alte bleiben. */
export function mergeDoc(prev: Doc | null, body: Record<string, unknown>, campaign: string, now = new Date()): Doc {
  const doc: Doc = prev ? { ...prev, days: [...(prev.days || [])], ads: [...(prev.ads || [])] } : { campaign, days: [], ads: [] };
  doc.campaign = campaign;
  if (body.stand !== undefined) doc.stand = str(body.stand, 40);
  if (body.plan && typeof body.plan === "object") {
    const p = body.plan as Record<string, unknown>;
    const plan: Plan = { ...(doc.plan || {}), ...pick<Plan>(p, PLAN_NUMS, num) };
    if (p.name !== undefined) plan.name = str(p.name, 60);
    for (const k of ["start", "ende"] as const) if (typeof p[k] === "string" && DATE.test(p[k] as string)) plan[k] = p[k] as string;
    if (Array.isArray(p.meta_campaign_ids)) plan.meta_campaign_ids = p.meta_campaign_ids.map(x => str(x, 30)).filter(x => /^\d+$/.test(x)).slice(0, 10);
    if (p.google_campaign_id !== undefined) plan.google_campaign_id = str(p.google_campaign_id, 30).replace(/\D/g, "");
    if (p.checkout_campaign !== undefined) plan.checkout_campaign = str(p.checkout_campaign, 60);
    doc.plan = plan;
  }
  if (Array.isArray(body.days)) for (const raw of body.days.slice(0, 1000)) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    if (typeof d.date !== "string" || !DATE.test(d.date)) continue;
    const day: AdDay = { date: d.date, ...pick<AdDay>(d, DAY_NUMS, num), ...(d.partial === true ? { partial: true } : {}) };
    const i = doc.days.findIndex(x => x.date === day.date);
    /* mergeDays (Formular im Dashboard): nur die mitgeschickten Felder ersetzen, der Rest des Tages bleibt. Sonst ersetzt der Tag den Tag. */
    if (i >= 0 && body.mergeDays === true) { const m: AdDay = { ...doc.days[i], ...day }; if (d.partial === false) delete m.partial; doc.days[i] = m; }
    else if (i >= 0) doc.days[i] = day; else doc.days.push(day);
  }
  doc.days = doc.days.sort((a, b) => a.date.localeCompare(b.date)).slice(-1000); // fast drei Jahre, damit Ausgaben so lange bleiben wie das Archiv
  if (Array.isArray(body.ads)) for (const raw of body.ads.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const ad: Ad = { name: str(a.name, 60) || str(a.id, 30), ...pick<Ad>(a, AD_NUMS, num) };
    if (!ad.name) continue;
    if (a.id !== undefined) ad.id = str(a.id, 30);
    if (a.status !== undefined) ad.status = str(a.status, 60);
    const i = doc.ads.findIndex(x => (ad.id && x.id === ad.id) || (!ad.id && x.name === ad.name));
    if (i >= 0) doc.ads[i] = ad; else doc.ads.push(ad);
  }
  doc.ads = doc.ads.slice(-40);
  if (body.google && typeof body.google === "object") doc.google = pick<GoogleBlock>(body.google as Record<string, unknown>, GOOGLE_NUMS, num);
  if (body.next !== undefined) doc.next = str(body.next, 600);
  if (Array.isArray(body.open)) doc.open = body.open.map(x => str(x, 160)).filter(Boolean).slice(0, 20);
  doc.updatedAt = now.toISOString();
  return doc;
}

/* ---------- KPI für das Dashboard ---------- */
export type Ampel = { farbe: "grau" | "gruen" | "gelb" | "rot"; text: string };
export function ampel(spend: number, contracts: number, plan: Plan = {}): Ampel {
  const budgetDay = (plan.budget_tag_meta || 0) + (plan.budget_tag_google || 0);
  if (!contracts) {
    if (!spend) return { farbe: "grau", text: "zu früh" };
    if (!budgetDay) return { farbe: "grau", text: "Plan fehlt" };
    return spend < 2 * budgetDay ? { farbe: "grau", text: "zu früh" } : { farbe: "rot", text: "rechnet sich nicht" };
  }
  if (plan.cpa_ok === undefined || plan.cpa_abschalt === undefined) return { farbe: "grau", text: "Plan fehlt" };
  const cpa = spend / contracts;
  return cpa <= plan.cpa_ok ? { farbe: "gruen", text: "läuft" } : cpa <= plan.cpa_abschalt ? { farbe: "gelb", text: "grenzwertig" } : { farbe: "rot", text: "rechnet sich nicht" };
}
const sum = (xs: (number | undefined)[]) => Math.round(xs.reduce<number>((s, x) => s + (x || 0), 0) * 100) / 100;

/* Archiv (Store skilltool2-sales), damit Verträge und Trichter die 30-Tage-Löschung der Checkout-Datensätze überstehen
   (checkout-reminder.mts), während die Ausgaben bleiben. Eine Zeile je Datensatz, ohne Personendaten: t = Hash des Tokens,
   e = HMAC der E-Mail (für REPORT_IGNORE_EMAILS), c = Tag von Schritt 1, p = bis zur Zahlung, s = Quelle, k = Vertrag,
   x = Test nach Name oder Domain. Solange ein Datensatz existiert, entscheiden die Live-Daten. Das Archiv zählt nur für gelöschte.
   Es wird nie gefiltert gespeichert: Testregel, Ignorierliste und Zeitraum gelten erst beim Zählen, und jede Aktion (Zuordnung)
   hat ein eigenes Archiv. Umbenennen oder Ausblenden lässt sich so rückgängig machen (Prüfungen 21.11.2026). */
export interface ArchEntry { t: string; e: string; c: string; p: boolean; s: string; k?: { d: string; id: string }; x?: true }
export interface SalesArchive { v: 3; key: string; entries: ArchEntry[]; savedAt: string }
const tokenTag = (token: string) => createHash("sha256").update("st2tok|" + token).digest("hex").slice(0, 24);
const emailTag = (email: string) => createHmac("sha256", env().secret || "st2").update("st2mail|" + email.trim().toLowerCase()).digest("hex").slice(0, 24);
/** Aktion in den Checkout-Datensätzen, zu der eine Dashboard-Kampagne gehört */
export const checkoutKey = (doc: Doc | null, campaign: string) => doc?.plan?.checkout_campaign || CHECKOUT_CAMPAIGN[campaign] || doc?.plan?.name || campaign;
/** Ein Archiv je Kampagne und Aktion: eine geänderte Zuordnung überschreibt das alte Archiv nicht */
export const archiveId = (doc: Doc | null, campaign: string) => `${campaign}/${createHash("sha256").update(checkoutKey(doc, campaign)).digest("hex").slice(0, 12)}`;

export function salesFor(doc: Doc | null, campaign: string, leads: CheckoutLead[], opts: { archive?: SalesArchive | null; ignoreEmails?: string[]; now?: Date } = {}): { stats: CampaignStats; archive: SalesArchive } {
  const plan = doc?.plan || {};
  const key = checkoutKey(doc, campaign);
  const ignoreTags = new Set((opts.ignoreEmails || []).map(x => x.trim()).filter(Boolean).map(emailTag));
  const existing = new Set(leads.map(l => tokenTag(l.token)));
  const live: ArchEntry[] = leads.filter(l => campaignOf(l) === key).map(l => {
    const dt = doneTime(l);
    return { t: tokenTag(l.token), e: emailTag(l.email || ""), c: dayOf(l.createdAt), p: reachedPayment(l), s: sourceGroup(l.utm),
      ...(dt && l.contractId ? { k: { d: dayOf(dt), id: l.contractId } } : {}), ...(isTestByRule(l) ? { x: true as const } : {}) };
  });
  /* Archivzeilen nur für Datensätze, die es nicht mehr gibt; gespeichert wird alles ungefiltert */
  const old = opts.archive && opts.archive.v === 3 && opts.archive.key === key ? opts.archive.entries.filter(x => x && !existing.has(x.t)) : [];
  const all = [...live, ...old];
  const counted = (e: ArchEntry) => !e.x && !ignoreTags.has(e.e);
  const inRange = (d: string) => !!d && (!plan.start || d >= plan.start) && (!plan.ende || d <= plan.ende);
  const days = new Map<string, DayStats>(), src = new Map<string, { starts: number; contracts: number }>();
  const day = (d: string) => { let x = days.get(d); if (!x) { x = { date: d, starts: 0, payment: 0, contracts: 0 }; days.set(d, x); } return x; };
  const stats: CampaignStats = { starts: 0, payment: 0, contracts: 0, days: [], contractList: [], sources: [], tests: live.filter(e => !counted(e)).length };
  for (const e of all) {
    if (!counted(e)) continue;
    const s = src.get(e.s) || { starts: 0, contracts: 0 };
    if (inRange(e.c)) { stats.starts++; day(e.c).starts++; s.starts++; if (e.p) { stats.payment++; day(e.c).payment++; } }
    if (e.k && inRange(e.k.d)) { stats.contracts++; day(e.k.d).contracts++; s.contracts++; stats.contractList.push({ date: e.k.d, contractId: e.k.id, source: e.s }); }
    if (s.starts || s.contracts) src.set(e.s, s);
  }
  stats.days = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  stats.contractList.sort((a, b) => a.date.localeCompare(b.date) || a.contractId.localeCompare(b.contractId));
  stats.sources = [...src].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.contracts - a.contracts || b.starts - a.starts || a.source.localeCompare(b.source));
  return { stats, archive: { v: 3, key, entries: all, savedAt: (opts.now || new Date()).toISOString() } };
}

export function buildKpi(doc: Doc | null, campaign: string, stats: CampaignStats, opts: { now?: Date; campaigns?: string[] } = {}) {
  const now = opts.now || new Date();
  const plan = doc?.plan || {};
  const today = dayOf(now.toISOString());
  /* Ausgaben und Klicks im selben Zeitraum wie Verträge und Formulare (plan.start/ende) */
  const adDays = (doc?.days || []).filter(d => (!plan.start || d.date >= plan.start) && (!plan.ende || d.date <= plan.ende));
  const spend_meta = sum(adDays.map(d => d.meta)), spend_google = sum(adDays.map(d => d.google)), spend = Math.round((spend_meta + spend_google) * 100) / 100;
  const contracts = stats.contracts;
  const google = doc?.google || {};
  const clicks = sum(adDays.map(d => Math.max(0, (d.link_clicks || 0) - (d.junk_clicks || 0)))) + (google.clicks || 0);
  /* Tage: Werbetage und Verkaufstage zusammen, im Aktionszeitraum */
  const dates = new Set<string>([...adDays.map(d => d.date), ...stats.days.map(d => d.date)]);
  const days = [...dates].filter(d => (!plan.start || d >= plan.start) && (!plan.ende || d <= plan.ende)).sort().map(date => {
    const a = adDays.find(d => d.date === date) || { date }, s = stats.days.find(d => d.date === date);
    return { ...a, starts: s?.starts || 0, payment: s?.payment || 0, contracts: s?.contracts || 0, partial: !!a.partial || date === today };
  });
  const adSpend = sum((doc?.ads || []).map(a => a.spend));
  const ads = (doc?.ads || []).map(a => ({ ...a, share: adSpend ? Math.round(((a.spend || 0) / adSpend) * 1000) / 10 : 0 })).sort((x, y) => (y.spend || 0) - (x.spend || 0));
  const dayIndex = plan.start ? Math.floor((Date.parse(today + "T12:00:00Z") - Date.parse(plan.start + "T12:00:00Z")) / 86400000) + 1 : undefined;
  const dayCount = plan.start && plan.ende ? Math.floor((Date.parse(plan.ende + "T12:00:00Z") - Date.parse(plan.start + "T12:00:00Z")) / 86400000) + 1 : undefined;
  return {
    campaign, campaigns: opts.campaigns || [campaign], stand: doc?.stand || "", updatedAt: doc?.updatedAt || "", plan,
    tag: dayIndex && dayCount ? { x: Math.min(Math.max(dayIndex, 0), dayCount), y: dayCount } : null,
    totals: { spend_meta, spend_google, spend, contracts, cpa: contracts ? Math.round((spend / contracts) * 100) / 100 : null, ampel: ampel(spend, contracts, plan) },
    funnel: { clicks, starts: stats.starts, payment: stats.payment, contracts },
    contracts: stats.contractList, sources: stats.sources.slice(0, 8), tests_hidden: stats.tests,
    days, ads, google, next: doc?.next || "", open: doc?.open || [],
  };
}
