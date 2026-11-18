/*
 * Black Month 2026: zentrale Daten der Aktion (6 Monate Gym für 149 € einmalig, 2. bis 30.11.2026, Start bis 15.12.2026).
 * Alles mit Ablaufdatum: useBlackMonthActive() liefert im Prerender und beim ersten Render immer true (kein Hydration-Sprung),
 * im Browser dann das Berliner Datum. Ab 1.12. verschwinden Banner, Menüpunkt, Karte und Hero-Knopf von allein, /blackmonth leitet auf die Startseite.
 */
import { useEffect, useState } from "react";

/* ended: Aktion am 18.11.2026 vorzeitig beendet (Boris). Schaltet Banner, Menüpunkt, Karte und Hero-Knopf sofort ab, auch im Prerender. */
export const BLACK_MONTH = { ended: true, start: "2026-11-02", end: "2026-11-30", lastStart: "2026-12-15", price: 149, months: 6, link: "https://buy.stripe.com/dRm28r7k7gf57zO6Hd5EY08", campaign: "blackmonth_2026" } as const;

export const berlinToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
export const blackMonthActive = (today = berlinToday()) => !BLACK_MONTH.ended && today <= BLACK_MONTH.end;

/** true, solange die Aktion läuft (bis einschließlich 30.11.2026). Erster Render immer true, damit Prerender und Client übereinstimmen. */
export function useBlackMonthActive(): boolean {
  const [active, setActive] = useState(!BLACK_MONTH.ended);
  useEffect(() => { setActive(blackMonthActive()); }, []);
  return active;
}

/** Hero-Überschrift je Anzeige (utm_content). Ohne Parameter oder unbekannt: Standardfassung (bm01_rack). */
export const HERO_VARIANTS: Record<string, { title: [string, string, string]; subline: string }> = {
  bm04_sled_25eur: { title: ["Unter 25 €", "im Monat.", ""], subline: "6 Monate Gym für einmalig 149 €. Kein Abo, endet von allein." },
  bm05_strength_6monate: { title: ["6 Monate Gym.", "Einmal zahlen.", ""], subline: "149 € einmalig, kein Abo, endet von allein. Unter 25 € im Monat." },
};
export const HERO_DEFAULT = { title: ["Black Month.", "6 Monate Gym.", "149 €."] as [string, string, string], subline: "Einmal zahlen. Kein Abo. Endet von allein." };

/** utm_content nur aus der aktuellen URL (ohne Parameter immer die Standardfassung, auch wenn die Sitzung noch UTM-Werte kennt). */
export function heroVariant(): { title: [string, string, string]; subline: string } {
  try { return HERO_VARIANTS[new URLSearchParams(window.location.search).get("utm_content") || ""] || HERO_DEFAULT; } catch { return HERO_DEFAULT; }
}
