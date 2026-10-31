/*
 * Shop-Produkte (aus manus-src/server/stripe.ts, Preise in Cent).
 * Zahlung über Stripe Payment Links: pro Produkt einen Link im Stripe-Dashboard anlegen und hier eintragen.
 * Weiterleitung nach Zahlung: https://skill-studios.com/shop/danke?p=<id>&session_id={CHECKOUT_SESSION_ID}
 * Solange paymentLink leer ist, führt der Kaufknopf zu WhatsApp.
 */
export interface ShopProduct {
  id: string; name: string; description: string; price: number; originalPrice?: number;
  category: "trial" | "ticket" | "pass" | "pt" | "aktion"; features: string[]; popular?: boolean; oneTimeOnly?: boolean; perUnit?: string;
  paymentLink: string;
}
export const SHOP_PRODUCTS: ShopProduct[] = [
  /* Aktion Black Month (2.11. bis 30.11.2026): Einmalzahlung, eigene Seite /blackmonth, nicht im Shop-Raster. Link aus .env VITE_STRIPE_LINK_BLACKMONTH (scripts/stripe-blackmonth.mjs legt ihn an). */
  { id: "black-month", name: "Black Month: 6 Monate Gym", description: "ONLY GYM. 6 Monate Gym für 149 € Einmalzahlung, buchbar 2.11. bis 30.11.2026.", price: 14900, category: "aktion",
    features: ["6 Monate Gym", "149 € einmalig, keine Folgekosten", "Nur Gym, keine Classes", "Buchbar 2. bis 30. November 2026"], paymentLink: (import.meta.env.VITE_STRIPE_LINK_BLACKMONTH || "").trim() },
  { id: "trial-pass", name: "Trial Pass", description: "3 Kurse zum Kennenlernen. Teste SKILL ohne Abo, einmalig pro Person.", price: 2900, originalPrice: 6000, category: "trial", oneTimeOnly: true,
    features: ["3 Kurse deiner Wahl", "Alle Formate verfügbar", "Coaching durch unsere Trainer", "Gültig für 3 Wochen", "Nur 9,67 € pro Kurs"], paymentLink: "https://buy.stripe.com/14A00j5bZ4wn6vKc1x5EY00" },
  { id: "drop-in", name: "Drop In", description: "1 Kurs deiner Wahl. Flexibel, spontan, ohne Bindung.", price: 2000, category: "ticket",
    features: ["1 Kurs deiner Wahl", "Alle Formate verfügbar", "Trainingshandtuch inklusive", "Sofort einlösbar"], paymentLink: "https://buy.stripe.com/8x27sLdIv0g7cU86Hd5EY04" },
  { id: "5-pass", name: "5 Pass", description: "5 Kurse innerhalb von 6 Wochen. Flexibel und günstiger als Einzeltickets.", price: 9000, category: "pass", popular: true,
    features: ["5 Kurse deiner Wahl", "Gültig für 6 Wochen", "Alle Formate verfügbar", "Trainingshandtuch inklusive", "18 € pro Kurs statt 20 €"], paymentLink: "https://buy.stripe.com/4gM14ncEr4wn2fuc1x5EY01" },
  { id: "10-pass", name: "10 Pass", description: "10 Kurse. Maximale Flexibilität zum besten Preis pro Einheit.", price: 17000, category: "pass",
    features: ["10 Kurse deiner Wahl", "Gültig für 12 Wochen", "Alle Formate verfügbar", "Trainingshandtuch inklusive", "17 € pro Kurs statt 20 €"], paymentLink: "https://buy.stripe.com/8x28wP0VJ9QH7zO9Tp5EY05" },
  /* Personal Training (Stand 2026-10-08, Boris): Einzelstunde 60 Min 120 €, 5er- und 10er-Karte je 45 Min, 10er 900 €.
     Immer inklusive: Kennenlernen mit komplettem Assessment, Anamnese, Trainingsprogramm, Erfolgsversprechen mit Geld-zurück-Garantie. */
  { id: "pt-single", name: "Einzelstunde", description: "1 × 60 Minuten 1:1", price: 12000, category: "pt", perUnit: "60 Minuten, einmalig",
    features: ["60 Minuten 1:1 mit Boris", "Assessment und Anamnese inklusive", "Dein Trainingsprogramm", "Erfolgsversprechen, sonst Geld zurück"], paymentLink: "https://buy.stripe.com/3cIcN50VJd2TcU8d5B5EY06" },
  { id: "pt-5er", name: "5er-Karte", description: "5 × 45 Minuten 1:1", price: 50000, category: "pt", perUnit: "100 € je Einheit à 45 Minuten",
    features: ["5 × 45 Minuten 1:1 mit Boris", "Assessment und Anamnese inklusive", "Dein Trainingsprogramm", "Check-ins zwischen den Einheiten", "Erfolgsversprechen, sonst Geld zurück"], paymentLink: "https://buy.stripe.com/bJe8wPdIvgf51bq3v15EY02" },
  { id: "pt-10er", name: "10er-Karte", description: "10 × 45 Minuten 1:1", price: 90000, category: "pt", popular: true, perUnit: "90 € je Einheit à 45 Minuten",
    features: ["10 × 45 Minuten 1:1 mit Boris", "Assessment und Anamnese inklusive", "Dein Trainingsprogramm", "Check-ins und Scan zur Kontrolle", "Erfolgsversprechen, sonst Geld zurück"], paymentLink: "https://buy.stripe.com/4gM9AT9sffb107m9Tp5EY03" },
];
export const shopPrice = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: cents % 100 ? 2 : 0 })} €`;
export const findProduct = (id: string | null) => SHOP_PRODUCTS.find(p => p.id === id) || null;
