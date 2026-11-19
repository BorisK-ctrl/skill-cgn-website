/* Klick-Ereignisse für Meta und Google, benannt nach Ziel (cta_probetraining_hero …).
   Nur nach Cookie-Zustimmung: fbq und gtag existieren erst dann. Einmal je Sitzung, mit UTM-Parametern der Sitzung. */
import { trackCustomOnce } from "./pixel";

/** UTM-Parameter beim ersten Aufruf merken (Sitzung), damit spätere Klicks die Quelle behalten. */
export function utmParams(): Record<string, string> {
  try {
    const stored = sessionStorage.getItem("skill-utm-params");
    if (stored) return JSON.parse(stored);
    const p = new URLSearchParams(window.location.search); const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"]) { const v = p.get(k); if (v) out[k] = v.slice(0, 200); }
    /* Klick-IDs überleben die Sitzung (localStorage), damit ein späterer Abschluss der Anzeige zugeordnet werden kann. */
    try { const old = JSON.parse(localStorage.getItem("skill-click-ids") || "{}"); for (const k of ["fbclid", "gclid", "utm_source", "utm_campaign"]) if (!out[k] && old[k]) out[k] = old[k]; if (out.fbclid || out.gclid) localStorage.setItem("skill-click-ids", JSON.stringify({ fbclid: out.fbclid, gclid: out.gclid, utm_source: out.utm_source, utm_campaign: out.utm_campaign, at: Date.now() })); } catch {}
    if (Object.keys(out).length) sessionStorage.setItem("skill-utm-params", JSON.stringify(out));
    return out;
  } catch { return {}; }
}

/* Quelle des Besuchs fürs Team (Magicline-Notiz, Mail "Neuer Vertrag", Tagesbericht). Bestimmt bei jedem Laden der Seite (App-Start), denn die
   Links der Startseite zu /blackweek nehmen die UTM-Parameter nicht mit. Format: "utm_source / utm_medium / utm_campaign[ / utm_content]
   · Google-Anzeige · Einstieg /". Ohne UTM: Kanal aus der Klick-ID (gclid, wbraid, gbraid = Google-Anzeige; fbclid = Instagram/Facebook,
   bezahlt oder nicht) oder aus dem Referrer, sonst "direkt".
   Datenschutz: beim Laden nur im Arbeitsspeicher (übersteht den Wechsel Startseite → /blackweek). In den sessionStorage erst beim Absenden
   eines Formulars (persist), wie vorher utmSource. Eine neue Anzeige oder Kampagne im selben Tab ersetzt die alte Quelle, ein späterer
   direkter Aufruf nicht. */
const SRC_KEYS = ["skill-src", "skill-src-content"] as const;
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "wbraid", "gbraid", "fbclid", "msclkid", "ttclid"];
const srcMemo: Record<string, string> = {};
const srcClean = (v: string) => v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
/** Kanal aus Hostname oder Android-Paket (android-app://com.google.android.gm). Gleiche Regeln im Tagesbericht (lib/sales-report.ts). */
export function channelOf(host: string, app = false): string {
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
function refChannel(ref: string): string {
  let u: URL; try { u = new URL(ref); } catch { return "direkt"; }
  if (u.protocol === "android-app:") { const pkg = (u.hostname || u.pathname.replace(/^\/+/, "").split("/")[0]).toLowerCase(); return pkg ? channelOf(srcClean(pkg), true) : "direkt"; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "direkt";
  const host = u.hostname.toLowerCase();
  if (!host) return "direkt";
  if (host.replace(/^www\./, "") === location.hostname.replace(/^www\./, "")) return "intern";
  return channelOf(host);
}
function computeSource(withContent: boolean): string {
  try {
    const p = new URLSearchParams(window.location.search);
    const utm = ["utm_source", "utm_medium", "utm_campaign", ...(withContent ? ["utm_content"] : [])].map(k => srcClean(p.get(k) || "")).filter(Boolean);
    const ref = refChannel(document.referrer);
    const ad = p.get("gclid") || p.get("wbraid") || p.get("gbraid") ? "Google-Anzeige" : p.get("msclkid") ? "Microsoft-Anzeige" : p.get("ttclid") ? "TikTok-Anzeige"
      : p.get("fbclid") ? (ref === "Instagram" || ref === "Facebook" ? ref : "Instagram/Facebook") : "";
    const head = utm.length ? utm.join(" / ") + (ad ? " · " + ad : "") : ad || ref;
    return `${head} · Einstieg ${srcClean(window.location.pathname) || "/"}`.slice(0, 160); // Magicline-Notiz bleibt unter 300 Zeichen
  } catch { return "unbekannt"; }
}
const storedSource = (key: string) => { try { return sessionStorage.getItem(key) || ""; } catch { return ""; } };
const weakSource = (v: string) => /^(direkt|intern|unbekannt)( · |$)/.test(v);
/** App-Start, bei jedem Laden: Quelle im Arbeitsspeicher festhalten, bevor ein Link der Startseite die URL ändert. Schreibt nichts in den Browser.
    Gespeichert ist eine Quelle nur, wenn in diesem Tab schon ein Formular abgeschickt wurde; eine neue Kampagne ersetzt sie. */
export function captureLandingSource() {
  let campaign = false;
  try { const p = new URLSearchParams(window.location.search); campaign = CAMPAIGN_KEYS.some(k => p.get(k)); } catch {}
  for (const key of SRC_KEYS) {
    const fresh = computeSource(key === SRC_KEYS[1]);
    const prev = srcMemo[key] || storedSource(key);
    srcMemo[key] = !prev || campaign || (weakSource(prev) && !weakSource(fresh)) ? fresh : prev;
  }
}
/** Quelle der Sitzung. withContent: mit utm_content (welche Anzeige). persist: beim Absenden eines Formulars im Tab sichern (übersteht Neuladen). */
export function landingSource(withContent = false, persist = false): string {
  const key = SRC_KEYS[withContent ? 1 : 0];
  const v = srcMemo[key] || storedSource(key) || computeSource(withContent);
  srcMemo[key] = v;
  if (persist) try { sessionStorage.setItem(key, v); } catch {}
  return v;
}
/** Rückkehr über die Erinnerungsmail: Quelle aus Schritt 1 behalten. Nur Arbeitsspeicher, gesichert wird beim nächsten Absenden. */
export function setSessionSource(v: string) { for (const k of SRC_KEYS) srcMemo[k] = v; }

function onceKey(name: string) { try { const k = "skill-ev-" + name; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, "1"); } catch {} return true; }

/** Ereignis an Meta (benutzerdefiniert) und Google (gtag event). */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const data = { ...utmParams(), ...params };
  trackCustomOnce(name, name, data);
  if (window.gtag && onceKey("g-" + name)) window.gtag("event", name, data);
}
/** Klick auf einen Knopf: cta_<ziel>_<ort> */
export const trackCta = (name: string) => trackEvent(name, { event_category: "cta" });
