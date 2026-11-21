/* SKILLTOOL2 (internes KPI-Dashboard), alle Server-Wege in einer Function:
   POST /api/skilltool2/login {password} → Cookie st2 (30 Tage) · GET /skilltool2/logout → Cookie weg, zurück zur Startseite
   GET  /api/skilltool2/kpi?campaign=bw29 → Dashboard-Daten (nur mit Sitzung)
   POST /api/skilltool2/ads   → Werbezahlen, Plan, Google-Block (Sitzung oder Authorization: Bearer SKILLTOOL2_API_TOKEN)
   POST /api/skilltool2/notes {next, open[]} → Nächste Entscheidung, Offene Punkte (Sitzung oder Token)
   Bremse: höchstens 10 Anmeldeversuche je Anschluss und Stunde, jeder Versuch zählt vor der Prüfung (atomar, auch bei vielen gleichzeitigen
   Anfragen); Speicher gestört: keine Anmeldung. Falsche API-Tokens zählen in dieselbe Bremse. Alle Antworten no-store (lib/util json). */
import type { Config } from "@netlify/functions";
import { json, clientKey } from "./lib/util";
import { hitCount, allowHit, getSt2Doc, saveSt2Doc, listSt2Campaigns, listCheckoutLeads, getSt2Sales, saveSt2Sales } from "./lib/store";
import { configured, passwordOk, sessionCookie, clearCookie, hasSession, hasApiToken, mergeDoc, buildKpi, statsFor, snapshotOf, CAMPAIGN, type Doc, type SalesSnap } from "./lib/skilltool2";

const HOUR = 3600000, MAX_FAILS = 10;
const failKey = (req: Request) => "st2fail/" + clientKey(req);
const blocked = () => json({ error: "Zu viele Versuche, in einer Stunde wieder." }, 429);

export default async (req: Request) => {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "");
  if (path === "/skilltool2/logout") return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": clearCookie(), "Cache-Control": "no-store" } });
  if (!configured()) return json({ error: "SKILLTOOL2 ist noch nicht eingerichtet." }, 503);

  if (req.method === "POST") {
    if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) return json({ error: "Ungültige Anfrage" }, 415);
    if ((req.headers.get("sec-fetch-site") || "").toLowerCase() === "cross-site") return json({ error: "Ungültige Anfrage" }, 403);
  }

  if (path === "/api/skilltool2/login") {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const allowed = await allowHit(failKey(req), MAX_FAILS, HOUR).catch(() => null);
    if (allowed === null) return json({ error: "Gerade nicht erreichbar. Bitte gleich noch einmal." }, 503);
    if (!allowed) return blocked();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!passwordOk(b.password)) return json({ error: "Passwort stimmt nicht." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie() });
  }

  /* Alles andere: Sitzung, bei ads/notes auch API-Token */
  const session = hasSession(req);
  const viaToken = !session && req.method === "POST" && (path === "/api/skilltool2/ads" || path === "/api/skilltool2/notes") && !!req.headers.get("authorization");
  if (viaToken && await hitCount(failKey(req), HOUR).catch(() => 0) >= MAX_FAILS) return blocked();
  const authed = session || (viaToken && hasApiToken(req));
  if (!authed) { if (viaToken) await allowHit(failKey(req), MAX_FAILS, HOUR).catch(() => true); return json({ error: "Nicht angemeldet" }, 401); }

  if (path === "/api/skilltool2/kpi") {
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const campaigns = (await listSt2Campaigns().catch(() => [] as string[])).filter(c => CAMPAIGN.test(c)).sort();
    const campaign = url.searchParams.get("campaign") || campaigns[0] || "bw29";
    if (!CAMPAIGN.test(campaign)) return json({ error: "Unbekannte Kampagne" }, 400);
    const [doc, leads, snap] = await Promise.all([getSt2Doc<Doc>(campaign).catch(() => null), listCheckoutLeads().catch(() => []), getSt2Sales<SalesSnap>(campaign).catch(() => null)]);
    const stats = statsFor(doc, campaign, leads, { snap, ignoreEmails: (process.env.REPORT_IGNORE_EMAILS || "").split(",") });
    if (doc) await saveSt2Sales(campaign, snapshotOf(stats)).catch(e => console.log("skilltool2 Sicherung", String(e)));
    return json(buildKpi(doc, campaign, stats, { campaigns: campaigns.includes(campaign) ? campaigns : [...campaigns, campaign].sort() }));
  }

  if (path === "/api/skilltool2/ads" || path === "/api/skilltool2/notes") {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "Ungültige Daten" }, 400);
    const b = raw as Record<string, unknown>;
    const campaign = String(b.campaign || "bw29");
    if (!CAMPAIGN.test(campaign)) return json({ error: "Unbekannte Kampagne" }, 400);
    /* notes nimmt nur next und open an, ads alles außer next/open nur wenn mitgeschickt */
    const body = path === "/api/skilltool2/notes" ? { next: b.next, open: b.open } : b;
    if (path === "/api/skilltool2/notes" && b.next === undefined && !Array.isArray(b.open)) return json({ error: "next oder open fehlt" }, 400);
    const prev = await getSt2Doc<Doc>(campaign).catch(() => null);
    const doc = mergeDoc(prev, body as Record<string, unknown>, campaign);
    await saveSt2Doc(campaign, doc);
    console.log(`skilltool2 ${path.split("/").pop()} ${campaign}: ${doc.days.length} Tage, ${doc.ads.length} Anzeigen (${session ? "Sitzung" : "Token"})`);
    return json({ ok: true, campaign, days: doc.days.length, ads: doc.ads.length, updatedAt: doc.updatedAt });
  }
  return json({ error: "Nicht gefunden" }, 404);
};
export const config: Config = { path: ["/api/skilltool2/login", "/api/skilltool2/kpi", "/api/skilltool2/ads", "/api/skilltool2/notes", "/skilltool2/logout"] };
