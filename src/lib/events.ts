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
