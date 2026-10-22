/* Anzeige-Daten der drei Tarife (Leistungen, Parken) für Startseite, /memberships und Checkout. Preise kommen aus OFFERS bzw. live aus dem rate-bundle. */
import { OFFERS, type OfferKey } from "./magicline";

export interface Tarif {
  key: OfferKey; name: string; tagline: string; cta: string; link: string;
  recommended?: boolean; newOnly?: boolean;
  gym: string; classes: string; scan: string; plan: string; coachTalk: string | null;
  parkingPerWeek: 0 | 2 | 3;
  terms: string;            // Laufzeit, kurz
  features: string[];       // Aufzählung in Karten
}
export const TARIFE: Tarif[] = [
  { key: "start39", name: "START 39", tagline: "Nur online, nur Neukunden", cta: "START 39 sichern", link: "/start39", newOnly: true,
    gym: "Gym", classes: "4 Classes je vier Wochen", scan: "3D Scan zum Start", plan: "Plan mit deinem Namen", coachTalk: null, parkingPerWeek: 0,
    terms: "Monatlich kündbar, 1 Monat Mindestlaufzeit",
    features: ["Volles Gym", "4 Classes je 4 Wochen", "Getränke, Duschen, Trainingshandtuch", "3D Scan zum Start", "Plan mit deinem Namen", "Keine Aufnahmegebühr"] },
  { key: "mitgliedschaft", name: "SKILL Mitgliedschaft", tagline: "Der Standard", cta: "Mitgliedschaft wählen", link: "/checkout?offer=mitgliedschaft", recommended: true,
    gym: "Gym ohne Limit", classes: "6 Classes je vier Wochen", scan: "3D Scan zum Start und alle 12 Wochen", plan: "Plan mit deinem Namen", coachTalk: null, parkingPerWeek: 2,
    terms: "12 Monate oder monatlich kündbar",
    features: ["Gym ohne Limit", "6 Classes je vier Wochen", "3D Scan zum Start und alle 12 Wochen", "Plan mit deinem Namen"] },
  { key: "unlimited", name: "SKILL Unlimited", tagline: "Alles, ohne Limit", cta: "Unlimited wählen", link: "/checkout?offer=unlimited",
    gym: "Gym ohne Limit", classes: "Alle Classes", scan: "3D Scan alle 8 Wochen", plan: "Plan mit deinem Namen", coachTalk: "Coach Gespräch einmal im Monat", parkingPerWeek: 3,
    terms: "12 Monate oder monatlich kündbar",
    features: ["Gym ohne Limit", "Alle Classes", "3D Scan alle 8 Wochen", "Coach Gespräch einmal im Monat"] },
];
export const tarif = (key: OfferKey) => TARIFE.find(t => t.key === key)!;
export const offerOf = (key: OfferKey) => OFFERS[key];

/** Regel für START 39, steht im Preisblock, im Checkout vor der Unterschrift und in der FAQ. */
export const START39_OFFER = "39 € je 4 Wochen. 4 Classes je 4 Wochen. Monatlich kündbar. Getränke, Dusche und Handtuch inklusive.";
export const START39_RULE = "Nur für Neukunden. 1 Monat Mindestlaufzeit, verlängert sich automatisch um jeweils 1 Monat zu 39 €, kündbar mit 1 Monat Frist zum Laufzeitende.";
export const START39_RULE_SHORT = "monatlich kündbar, 1 Monat Mindestlaufzeit";

/** Parken, eine Quelle für alle Seiten. */
export const PARKING = {
  garage: "Parkhaus Brückenstraße", address: "Ludwigstraße 1", walk: "2 Minuten zu Fuß", perVisit: "1 Stunde je Besuch, wir zahlen",
  mitgliedschaft: 2, unlimited: 3,
  faqQ: "Kann ich bei euch parken?",
  faqA: "Ja, in der Mitgliedschaft 2 mal pro Woche, bei Unlimited 3 mal, je 1 Stunde im Parkhaus Brückenstraße. Ticket ziehen, trainieren, beim Rausgehen an der Rezeption entwerten lassen.",
  smallPrint: "Gilt im Parkhaus Brückenstraße, Ludwigstraße 1. Entwertung nur mit Check-in. Mehr als 1 Stunde zahlst du selbst. Gilt, solange die Kooperation besteht.",
  steps: [
    { title: "Einfahren und Ticket ziehen.", text: "Parkhaus Brückenstraße, Einfahrt Ludwigstraße 1." },
    { title: "Trainieren und einchecken.", text: "Check-in am Empfang wie immer, das ist die Bedingung." },
    { title: "Ticket entwerten.", text: "Beim Rausgehen an der Rezeption entwerten lassen, 1 Stunde ist drin." },
  ],
} as const;
export const parkingLabel = (perWeek: 0 | 2 | 3) => perWeek === 0 ? "Kein Parken" : `Parken ${perWeek} mal pro Woche, je 1 Stunde`;
