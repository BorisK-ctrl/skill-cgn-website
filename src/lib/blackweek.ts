/*
 * Black Week 2026: Gym Only für 29 € alle 4 Wochen, Abschluss 18. bis 30.11.2026, nur SEPA, Vertragsstart am Abschlusstag.
 * Magicline (gelesen am 18.11.2026 aus GET rate-bundle): Vertragsangebot 1215762330 "BLACK WEEK ONLY GYM 29", Laufzeit-Term 1215762340
 * (1 Monat, 29,00 € alle 4 Wochen, Verlängerung je 1 Monat, Kündigungsfrist 1 Monat), allowedPaymentChoices DIRECT_DEBIT, keine flatFees.
 * Ab 1.12. verschwinden Startseiten-Balken und Preishinweis von allein; taucht das Angebot im rate-bundle nicht mehr auf, zeigt /blackweek "beendet".
 */
import { useEffect, useState } from "react";
import { berlinToday } from "./blackmonth";

export const BLACK_WEEK = { offer: "BLACK WEEK 29", pixelName: "ONLY GYM 29", rateBundleId: 1215762330, termId: 1215762340, price: 29, regularFee: 89, end: "2026-11-30", afterPrice: 34 } as const;
export const blackWeekActive = (today = berlinToday()) => today <= BLACK_WEEK.end;

/** true bis einschließlich 30.11.2026. Erster Render immer true, damit Prerender und Client übereinstimmen. */
export function useBlackWeekActive(): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => { setActive(blackWeekActive()); }, []);
  return active;
}

/* Die Website wirbt immer nur für ein Angebot (Boris, 18.11.2026): bis 30.11. Black Week, danach wieder START 39 mit den bisherigen Texten.
   Genutzt von Startseiten-Banner, Hero-Knopf, fester Leiste mobil und dem gelben Knopf in der Navigation. */
export interface Promo { key: "blackweek" | "start39"; path: string; label: string; banner: string; cta: string; line: string; sticky: string; nav: string }
const START39_PROMO: Promo = { key: "start39", path: "/start39", label: "START 39:", banner: "39 € je 4 Wochen · monatlich kündbar · keine Aufnahmegebühr", cta: "START 39 sichern",
  line: "39 € je 4 Wochen · monatlich kündbar · keine Aufnahmegebühr · nur Neukunden", sticky: "START 39 sichern · 39 € alle vier Wochen", nav: "START 39" };
const BLACKWEEK_PROMO: Promo = { key: "blackweek", path: "/blackweek", label: "Black Week:", banner: "Gym Only 29\u00a0€ alle 4 Wochen · nur bis 30.11.", cta: "Gym Only 29\u00a0€ sichern",
  line: "29\u00a0€ alle 4 Wochen · monatlich kündbar · 0\u00a0€ Aufnahmegebühr · nur bis 30.11.", sticky: "Black Week · Gym Only 29\u00a0€ sichern", nav: "Black Week" };
export function usePromo(): Promo { return useBlackWeekActive() ? BLACKWEEK_PROMO : START39_PROMO; }

/** Reguläres Gym Only (Magicline 1215471120, Term 1215471130): 34 € alle 4 Wochen, 3 Monate Mindestlaufzeit, keine Aufnahmegebühr.
 *  Einziger zulässiger Streichpreis für Black Week (§ 11 PAngV: niedrigster Preis der letzten 30 Tage). Eine Aufnahmegebühr hatte Gym Only nie. */
export const ONLY_GYM_REGULAR = { rateBundleId: 1215471120, price: 34 } as const;
/** Live-Preise aus dem rate-bundle, Fallback die Listenpreise. */
export function blackWeekPrices(bundles: { id: number; terms?: { price: number }[] }[] | null) {
  const of = (id: number, fb: number) => bundles?.find(b => b.id === id)?.terms?.[0]?.price ?? fb;
  return { now: of(BLACK_WEEK.rateBundleId, BLACK_WEEK.price), was: of(ONLY_GYM_REGULAR.rateBundleId, ONLY_GYM_REGULAR.price) };
}
