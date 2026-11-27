import { useEffect, useState } from "react";
import { getRateBundles, type RateBundle, type RateBundleTerm } from "./magicline";

/* Preise kommen ausschließlich aus dem Magicline rate-bundle. Einmal laden, seitenübergreifend cachen. Jeder Tarif (term) bekommt den
   Vertragsbeginn seines Angebots mit (contractStartType), damit der Abschluss ihn ohne Nachschlagen kennt (Boris 27.11.2026). */
let cache: Promise<RateBundle[]> | null = null;
const withStartType = (bundles: RateBundle[]) => bundles.map(b => ({ ...b, terms: (b.terms || []).map(t => ({ ...t, contractStartType: b.contractStartType })) }));
export function loadRateBundles() { if (!cache) cache = getRateBundles().then(withStartType).catch(e => { cache = null; throw e; }); return cache; }

export function useRateBundles() {
  const [bundles, setBundles] = useState<RateBundle[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { let on = true; loadRateBundles().then(b => on && setBundles(b)).catch(() => on && setError(true)); return () => { on = false; }; }, []);
  return { bundles, error };
}

export function findBundle(bundles: RateBundle[] | null, name: string) {
  return bundles?.find(b => b.name.toLowerCase() === name.toLowerCase()) || null;
}
/** Laufzeit in Monaten: 1 = monatlich kündbar, 6, 12. */
export function termForMonths(bundle: RateBundle | null, months: 1 | 6 | 12): RateBundleTerm | null {
  if (!bundle?.terms?.length) return null;
  const exact = bundle.terms.find(t => t.termUnit === "MONTH" && t.termValue === months);
  if (exact) return exact;
  if (months === 1) return [...bundle.terms].sort((a, b) => a.termValue - b.termValue)[0];
  return null;
}
export const fmtPrice = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("de-DE", { minimumFractionDigits: 2 }));
export const feeSum = (t: RateBundleTerm | null) => (t?.flatFees || []).reduce((s, f) => s + f.price, 0);

/** Angebot im rate-bundle finden: erst über die Magicline-ID aus OFFERS, sonst über den Namen. */
import { OFFERS, type OfferKey } from "./magicline";
export function offerBundle(bundles: RateBundle[] | null, key: OfferKey): RateBundle | null {
  const o = OFFERS[key]; if (!bundles) return null;
  if (o.ids?.rateBundleId) { const byId = bundles.find(b => b.id === o.ids!.rateBundleId); if (byId) return byId; }
  return findBundle(bundles, o.bundle);
}
/** Laufzeit-Tarif des Angebots: erst über die Tarif-ID, sonst über die Laufzeit in Monaten. */
export function offerTerm(bundles: RateBundle[] | null, key: OfferKey, months: 1 | 12): RateBundleTerm | null {
  const o = OFFERS[key]; const b = offerBundle(bundles, key); if (!b) return null;
  const id = months === 12 ? o.ids?.term12Id : o.ids?.term1Id;
  if (id) { const t = b.terms.find(t => t.id === id); if (t) return t; }
  return termForMonths(b, months);
}
/** Preis fürs Prerendering und bei Ladefehlern: live aus dem rate-bundle, sonst der Listenpreis aus OFFERS. */
export function offerPrice(bundles: RateBundle[] | null, key: OfferKey, months: 1 | 12): number | null {
  const t = offerTerm(bundles, key, months); if (t) return t.price;
  const o = OFFERS[key]; return months === 12 ? o.prices.year : o.prices.monthly;
}
