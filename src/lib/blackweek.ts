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
