/* Google Ads Conversion-Messung mit Consent Mode v2.
   Das Google Tag lädt immer, aber mit Standard "denied" für alle vier Zustimmungsarten. Nach Cookie-Zustimmung "accepted" wird auf "granted"
   aktualisiert. Ohne Zustimmung schickt Google nur cookielose Pings (keine Cookies, keine Personalisierung), die Conversion wird modelliert.
   IDs aus .env: VITE_GADS_ID (AW-XXXXXXXXX) und VITE_GADS_LABEL. Solange Platzhalter oder leer, passiert nichts. */
import { consent, CONSENT_EVENT } from "./pixel";

declare global { interface Window { dataLayer?: any[]; gtag?: (...args: any[]) => void } }

export const GADS_ID = (import.meta.env.VITE_GADS_ID || "").trim();
export const GADS_LABEL = (import.meta.env.VITE_GADS_LABEL || "").trim();
const PLACEHOLDER = /X{4,}/i;

export function gadsConfigured() { return /^AW-\d+$/.test(GADS_ID) && !PLACEHOLDER.test(GADS_ID); }
function labelConfigured() { return GADS_LABEL.length > 0 && !PLACEHOLDER.test(GADS_LABEL); }

let loaded = false;
const GRANTED = { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "denied" } as const;
const DENIED = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" } as const;

export function loadGads() {
  if (loaded || typeof window === "undefined" || !gadsConfigured()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  /* Consent Mode v2: Standard vor dem Laden setzen; bei bereits erteilter Zustimmung direkt granted */
  window.gtag("consent", "default", { ...(consent() === "accepted" ? GRANTED : DENIED), wait_for_update: 500 });
  window.gtag("set", "ads_data_redaction", true);
  window.gtag("set", "url_passthrough", true);
  window.gtag("js", new Date());
  window.gtag("config", GADS_ID, { allow_enhanced_conversions: true });
  const s = document.createElement("script");
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GADS_ID)}`;
  document.head.appendChild(s);
}
function updateConsent(v: "accepted" | "denied") { if (window.gtag) window.gtag("consent", "update", v === "accepted" ? GRANTED : DENIED); }

/** Conversion "Kauf" melden: am echten Erfolgspunkt (/danke mit Vertragsnummer, /shop/danke mit Stripe-Sitzung). transaction_id sperrt Doppelzählung bei Reload. */
export function gadsConversion(p: { value?: number; currency?: string; transactionId?: string } = {}) {
  if (!loaded || !window.gtag || !labelConfigured()) return false;
  const key = "skill-gads-conv-" + (p.transactionId || "last");
  try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); } catch {}
  window.gtag("event", "conversion", { send_to: `${GADS_ID}/${GADS_LABEL}`, value: p.value, currency: p.currency || "EUR", transaction_id: p.transactionId });
  return true;
}

/** Einmal beim Start aufrufen. */
export function initGads() {
  if (typeof window === "undefined") return;
  loadGads();
  window.addEventListener(CONSENT_EVENT, (e) => updateConsent((e as CustomEvent).detail === "accepted" ? "accepted" : "denied"));
}
