/* SKILLTOOL2 (internes KPI-Dashboard), alle Server-Wege in einer Function:
   POST /api/skilltool2/login {password} → Cookie st2 (30 Tage) · GET /skilltool2/logout → Cookie weg, zurück zur Startseite
   GET  /api/skilltool2/kpi?campaign=bw29 → Dashboard-Daten (nur mit Sitzung)
   POST /api/skilltool2/ads   → Werbezahlen, Plan, Google-Block (Sitzung oder Authorization: Bearer SKILLTOOL2_API_TOKEN)
   POST /api/skilltool2/notes {next, open[]} → Nächste Entscheidung, Offene Punkte (Sitzung oder Token)
   Bremse: höchstens 10 Versuche je Anschluss und Stunde, Passwort und API-Token gemeinsam. Jeder Versuch zählt vor der Prüfung (atomar, auch
   bei vielen gleichzeitigen Anfragen, nur mit nachgelesenem Eintrag); Speicher gestört: keine Prüfung, 503. Ein richtiger Token gibt seinen
   Platz wieder frei, damit regelmäßige API-Aufrufe die Bremse nicht füllen. Alle Antworten no-store (lib/util json). */
import type { Config } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import { json, clientKey } from "./lib/util";
import { reserveHit, releaseHit, backoff, getSt2Doc, getSt2DocVersioned, saveSt2DocIf, hasWrite, listSt2Campaigns, listCheckoutLeadsChecked, getSt2Sales, saveSt2Sales, getSt2ArchiveKey } from "./lib/store";
import { configured, passwordOk, sessionCookie, clearCookie, hasSession, hasApiToken, mergeDoc, buildKpi, salesFor, archiveId, CAMPAIGN, type Doc, type SalesArchive } from "./lib/skilltool2";
import type { CheckoutLead } from "./lib/store";

const HOUR = 3600000, MAX_FAILS = 10;
/* Mischen und Schreiben höchstens 10-mal, danach noch einmal nur nachlesen (siehe unten) */
const SAVE_TRIES = 10;
const failKey = (req: Request) => "st2fail/" + clientKey(req);
const blocked = () => json({ error: "Zu viele Versuche, in einer Stunde wieder." }, 429);
/* Nicht "gleich": jeder Versuch belegt einen Platz in der Bremse, sofortiges Wiederholen während einer Störung verbraucht sie (Prüfung 21.11.2026) */
const unavailable = () => json({ error: "Gerade nicht erreichbar. Bitte in ein paar Minuten noch einmal." }, 503);
const storeDown = (status = 503) => json({ error: "Speicher gerade nicht erreichbar. Bitte gleich noch einmal." }, status);

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
    const allowed = await reserveHit(failKey(req), MAX_FAILS, HOUR).catch(() => null);
    if (allowed === null) return unavailable();
    if (!allowed) return blocked();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!passwordOk(b.password)) return json({ error: "Passwort stimmt nicht." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie() });
  }

  /* Alles andere: Sitzung, bei ads/notes auch API-Token. Token wie Passwort: erst Versuch belegen, dann prüfen (Prüfung 21.11.2026) */
  const session = hasSession(req);
  const viaToken = !session && req.method === "POST" && (path === "/api/skilltool2/ads" || path === "/api/skilltool2/notes") && !!req.headers.get("authorization");
  if (viaToken) {
    const hit = await reserveHit(failKey(req), MAX_FAILS, HOUR).catch(() => null);
    if (hit === null) return unavailable();
    if (!hit) return blocked();
    if (!hasApiToken(req)) return json({ error: "Nicht angemeldet" }, 401);
    if (!(await releaseHit(failKey(req), hit).catch(() => false))) console.log("skilltool2 Bremse: Platz eines richtigen Tokens nicht freigegeben");
  } else if (!session) return json({ error: "Nicht angemeldet" }, 401);

  if (path === "/api/skilltool2/kpi") {
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const campaigns = (await listSt2Campaigns().catch(() => [] as string[])).filter(c => CAMPAIGN.test(c)).sort();
    const campaign = url.searchParams.get("campaign") || campaigns[0] || "bw29";
    if (!CAMPAIGN.test(campaign)) return json({ error: "Unbekannte Kampagne" }, 400);
    /* Archiv nur mit vollständigen Eingaben neu schreiben: ein Lesefehler darf es nie verkleinern (Prüfung 21.11.2026) */
    let archive: SalesArchive | null = null, archiveOk = true, leads: CheckoutLead[] = [], leadsOk = true, tagKey = "";
    /* Dokument nicht lesbar: Fehler statt leerem Dashboard. Sonst stünde "Noch keine Werbezahlen" da, und wer dann Offene Punkte speichert,
       ersetzt die echte Liste durch die leere (Prüfung 21.11.2026, Runde 8). 502, weil 503 im Dashboard "nicht eingerichtet" heißt. */
    let doc: Doc | null;
    try { doc = await getSt2Doc<Doc>(campaign); } catch { return storeDown(502); }
    const aid = archiveId(doc, campaign);
    try { tagKey = await getSt2ArchiveKey(); archive = await getSt2Sales<SalesArchive>(aid); } catch { archiveOk = false; archive = null; tagKey = ""; }
    try { const r = await listCheckoutLeadsChecked(); leads = r.leads; leadsOk = r.complete; } catch { leadsOk = false; }
    const { stats, archive: next } = salesFor(doc, campaign, leads, { archive, tagKey, ignoreEmails: (process.env.REPORT_IGNORE_EMAILS || "").split(",") });
    if (doc && archiveOk && leadsOk) await saveSt2Sales(aid, next).catch(e => console.log("skilltool2 Archiv", String(e)));
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
    /* Lesen mit Version, Schreiben nur wenn unverändert (etag). Lesefehler: nichts schreiben. Gleichzeitig gespeichert: kurz warten, neu lesen,
       neu mischen. Der Vorgang trägt eine Kennung ins Dokument (w). Steht sie beim erneuten Lesen schon drin (Antwort verloren), ist er
       gespeichert und wird nicht ein zweites Mal gemischt; speichert jemand gleich danach darüber, gilt er trotzdem als gespeichert.
       Der letzte Durchlauf liest nur nach: ging die Antwort auf den letzten Schreibversuch verloren, steht die Kennung schon drin, und das
       ist ein Erfolg, kein 409 (Prüfung 21.11.2026, Runde 8). Jeder verlorene Versuch heißt, ein anderer Vorgang hat gespeichert, darum
       10 Versuche: 409 erst, wenn 10 andere in der Zwischenzeit gespeichert haben. */
    const wid = randomBytes(9).toString("hex");
    for (let i = 0; i <= SAVE_TRIES; i++) {
      let cur: { doc: Doc | null; etag: string | null };
      try { cur = await getSt2DocVersioned<Doc>(campaign); } catch { return storeDown(); }
      let doc: Doc, saved = false;
      if (cur.doc && hasWrite(cur.doc, wid)) { doc = cur.doc; saved = true; }
      else if (i === SAVE_TRIES) break;
      else {
        doc = mergeDoc(cur.doc, body as Record<string, unknown>, campaign);
        doc.w = [...(Array.isArray(cur.doc?.w) ? cur.doc!.w : []), wid].slice(-20);
        try { saved = await saveSt2DocIf(campaign, doc, cur.etag, wid); } catch { return storeDown(); }
        if (!saved) await backoff();
      }
      if (saved) {
        console.log(`skilltool2 ${path.split("/").pop()} ${campaign}: ${doc.days.length} Tage, ${doc.ads.length} Anzeigen (${session ? "Sitzung" : "Token"})`);
        return json({ ok: true, campaign, days: doc.days.length, ads: doc.ads.length, updatedAt: doc.updatedAt });
      }
    }
    return json({ error: "Gerade gleichzeitig gespeichert. Bitte noch einmal." }, 409);
  }
  return json({ error: "Nicht gefunden" }, 404);
};
export const config: Config = { path: ["/api/skilltool2/login", "/api/skilltool2/kpi", "/api/skilltool2/ads", "/api/skilltool2/notes", "/skilltool2/logout"] };
