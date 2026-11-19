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

/* Quelle des Besuchs fürs Team (Magicline-Notiz, Mail "Neuer Vertrag", Tagesbericht). Wird einmal auf der Einstiegsseite bestimmt
   (App-Start), denn die Links der Startseite zu /blackweek nehmen die UTM-Parameter nicht mit. Format:
   "utm_source / utm_medium / utm_campaign[ / utm_content] · Google-Anzeige · Einstieg /". Ohne UTM: Kanal aus der Klick-ID
   (gclid, wbraid, gbraid = Google-Anzeige; fbclid = Instagram/Facebook, bezahlt oder nicht) oder aus dem Referrer, sonst "direkt". */
const SRC_KEYS = ["skill-src", "skill-src-content"] as const;
const srcMemo: Record<string, string> = {};
const srcClean = (v: string) => v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
function refChannel(ref: string): string {
  let host = "";
  try { host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "direkt"; }
  if (!host) return "direkt";
  if (host === "skill-studios.com" || host.endsWith(".skill-studios.com") || host === location.hostname.replace(/^www\./, "")) return "intern";
  if (/(^|\.)instagram\.com$/.test(host)) return "Instagram";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return "Facebook";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "Google Suche/Maps";
  if (/(^|\.)tiktok\.com$/.test(host)) return "TikTok";
  return "Referrer " + host;
}
/** Quelle der Sitzung (auf der Einstiegsseite bestimmt). withContent: mit utm_content (welche Anzeige). */
export function landingSource(withContent = false): string {
  const key = SRC_KEYS[withContent ? 1 : 0];
  if (srcMemo[key]) return srcMemo[key];
  try { const s = sessionStorage.getItem(key); if (s) return (srcMemo[key] = s); } catch {}
  let v = "unbekannt";
  try {
    const p = new URLSearchParams(window.location.search);
    const utm = ["utm_source", "utm_medium", "utm_campaign", ...(withContent ? ["utm_content"] : [])].map(k => srcClean(p.get(k) || "")).filter(Boolean);
    const ref = refChannel(document.referrer);
    const ad = p.get("gclid") || p.get("wbraid") || p.get("gbraid") ? "Google-Anzeige" : p.get("msclkid") ? "Microsoft-Anzeige" : p.get("ttclid") ? "TikTok-Anzeige"
      : p.get("fbclid") ? (ref === "Instagram" || ref === "Facebook" ? ref : "Instagram/Facebook") : "";
    const head = utm.length ? utm.join(" / ") + (ad ? " · " + ad : "") : ad || ref;
    v = `${head} · Einstieg ${srcClean(window.location.pathname) || "/"}`.slice(0, 160); // Magicline-Notiz bleibt unter 300 Zeichen
  } catch {}
  srcMemo[key] = v;
  try { sessionStorage.setItem(key, v); } catch {}
  return v;
}
/** Quelle der Sitzung ersetzen: Rückkehr über die Erinnerungsmail behält die Quelle aus Schritt 1. */
export function setSessionSource(v: string) {
  for (const k of SRC_KEYS) { srcMemo[k] = v; try { sessionStorage.setItem(k, v); } catch {} }
}

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
