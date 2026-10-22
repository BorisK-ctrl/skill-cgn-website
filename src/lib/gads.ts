/* Google Ads Conversion-Messung. Lädt das Google Tag nur nach Cookie-Consent "accepted".
   IDs kommen aus .env: VITE_GADS_ID (AW-XXXXXXXXX) und VITE_GADS_LABEL (Conversion-Label).
   Solange Platzhalter oder leer, passiert nichts. */
import { consent, CONSENT_EVENT } from "./pixel";

declare global { interface Window { dataLayer?: any[]; gtag?: (...args: any[]) => void } }

export const GADS_ID = (import.meta.env.VITE_GADS_ID || "").trim();
export const GADS_LABEL = (import.meta.env.VITE_GADS_LABEL || "").trim();
const PLACEHOLDER = /X{4,}/i;

export function gadsConfigured() { return /^AW-\d+$/.test(GADS_ID) && !PLACEHOLDER.test(GADS_ID); }
function labelConfigured() { return GADS_LABEL.length > 0 && !PLACEHOLDER.test(GADS_LABEL); }

let loaded = false;
export function loadGads() {
  if (loaded || typeof window === "undefined" || !gadsConfigured()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  /* Consent Mode: das Tag wird erst nach Zustimmung geladen, daher hier direkt "granted". */
  window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "denied" });
  window.gtag("js", new Date());
  window.gtag("config", GADS_ID);
  const s = document.createElement("script");
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GADS_ID)}`;
  document.head.appendChild(s);
}

/** Conversion "Abschluss" melden. transactionId verhindert Doppelzählung bei Reload. */
export function gadsConversion(p: { value?: number; currency?: string; transactionId?: string } = {}) {
  if (!loaded || !window.gtag || !labelConfigured()) return;
  /* Sperre je Vertrag: verhindert Doppelzählung durch Reload oder doppelte Effekte. */
  const key = "skill-gads-conv-" + (p.transactionId || "last");
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
  window.gtag("event", "conversion", {
    send_to: `${GADS_ID}/${GADS_LABEL}`,
    value: p.value, currency: p.currency || "EUR", transaction_id: p.transactionId,
  });
}

/** Einmal beim Start aufrufen: lädt bei vorhandenem Consent, sonst beim Erteilen. */
export function initGads() {
  if (typeof window === "undefined") return;
  if (consent() === "accepted") loadGads();
  window.addEventListener(CONSENT_EVENT, (e) => { if ((e as CustomEvent).detail === "accepted") loadGads(); });
}
