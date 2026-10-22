/* Stripe für Mitgliedschaften per Karte, Apple Pay, Google Pay. Der Vertrag entsteht nach der Zahlung serverseitig (Magicline, Zahlart Banküberweisung).
   1. Express-Abschluss: Express Checkout Element direkt auf /start39 (src/components/ExpressCheckout.tsx), Abo über /api/stripe/express.
   2. Payment Link je Angebot als Kartenweg im Formular; leer = nicht verfügbar. client_reference_id = unser Checkout-Token. */
export const STRIPE_PK = (import.meta.env.VITE_STRIPE_PK || "").trim();
export const MEMBERSHIP_PAYMENT_LINKS: Record<string, string> = {
  "START 39": import.meta.env.VITE_STRIPE_LINK_START39 || "",
};
/** Angebote mit Stripe-Preis für den Express-Abschluss (Serverseite: netlify/functions/lib/stripe.ts PRICES). */
/* Angebote mit Stripe-Preis für den Express-Abschluss. SKILL Mitgliedschaft und SKILL Unlimited kommen dazu, sobald Boris die vier Preise in Stripe angelegt hat (VITE_EXPRESS_OFFERS + STRIPE_PRICE_* in Netlify). */
const EXPRESS_OFFERS = (import.meta.env.VITE_EXPRESS_OFFERS || "START 39,BACK 39").split(",").map((s: string) => s.trim()).filter(Boolean);
export const expressAvailable = (offerName: string) => !!STRIPE_PK && EXPRESS_OFFERS.includes(offerName);

export function membershipPaymentLink(offerName: string, token: string, email: string) {
  const base = MEMBERSHIP_PAYMENT_LINKS[offerName]; if (!base) return null;
  const u = new URL(base); u.searchParams.set("client_reference_id", token); if (email) u.searchParams.set("prefilled_email", email);
  return u.toString();
}

declare global { interface Window { Stripe?: (pk: string, opts?: Record<string, unknown>) => any } }
let loading: Promise<any> | null = null;
/** Stripe.js erst laden, wenn der Express-Abschluss gebraucht wird (nicht im Bundle, nicht beim Prerender). */
export function loadStripe(): Promise<any> {
  if (!STRIPE_PK || typeof window === "undefined") return Promise.resolve(null);
  if (window.Stripe) return Promise.resolve(window.Stripe(STRIPE_PK, { locale: "de" }));
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = "https://js.stripe.com/v3/"; s.async = true;
    s.onload = () => (window.Stripe ? resolve(window.Stripe(STRIPE_PK, { locale: "de" })) : reject(new Error("Stripe.js nicht geladen")));
    s.onerror = () => reject(new Error("Stripe.js nicht geladen"));
    document.head.appendChild(s);
  });
  return loading;
}
