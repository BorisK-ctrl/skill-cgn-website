import { PIXEL_ID } from "./magicline";
declare global { interface Window { fbq?: any; _fbq?: any } }
const KEY = "skill-cgn-cookie-consent";
export function consent(): "accepted" | "denied" | null { try { return localStorage.getItem(KEY) as any; } catch { return null; } }
export const CONSENT_EVENT = "skill:consent-changed";
export const OPEN_COOKIE_SETTINGS_EVENT = "skill:open-cookie-settings";
export function setConsent(v: "accepted" | "denied") { try { localStorage.setItem(KEY, v); } catch {} if (v === "accepted") loadPixel(); window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v })); }
export function openCookieSettings() { window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT)); }
export function loadPixel() {
  if (window.fbq) return;
  /* eslint-disable */
  (function(f: any,b: any,e: any,v: any,n?: any,t?: any,s?: any){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq("init", PIXEL_ID); window.fbq("track", "PageView");
}
export function track(event: string, params?: Record<string, any>, opts?: Record<string, any>) { if (window.fbq) window.fbq("track", event, params, opts); }
export function trackCustom(event: string, params?: Record<string, any>) { if (window.fbq) window.fbq("trackCustom", event, params); }

/* Einmal je Sitzung: Schlüssel in sessionStorage, damit Reload oder Zurück nichts doppelt zählt. */
function once(key: string) { try { const k = "skill-ev-" + key; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, "1"); } catch {} return true; }
export function trackOnce(key: string, event: string, params?: Record<string, any>) { if (!window.fbq) return; if (once(key)) track(event, params); }
export function trackCustomOnce(key: string, event: string, params?: Record<string, any>) { if (!window.fbq) return; if (once(key)) trackCustom(event, params); }
