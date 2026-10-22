/*
 * Strukturierte Daten (Schema.org JSON-LD) pro Seite.
 * Beim Prerendering werden die Blöcke gesammelt und in den <head> der statischen HTML-Datei geschrieben (scripts/prerender.mjs).
 * Im Browser rendert <JsonLd> nichts, damit es keinen Hydrations-Unterschied gibt; Crawler lesen das vorgerenderte HTML.
 */
import { SITE_URL } from "@/routes";

export const jsonLdCollector: string[] = [];
export function resetJsonLd() { jsonLdCollector.length = 0; }

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  if (import.meta.env.SSR) {
    const s = JSON.stringify({ "@context": "https://schema.org", ...data });
    if (!jsonLdCollector.includes(s)) jsonLdCollector.push(s);
  }
  return null;
}

/** FAQPage aus einem sichtbaren FAQ-Block, Fragen und Antworten identisch zum Text. */
export function FaqJsonLd({ items }: { items: readonly (readonly [string, string])[] | readonly { q: string; a: string }[] }) {
  const list = (items as readonly unknown[]).map(i => Array.isArray(i) ? { q: i[0] as string, a: i[1] as string } : (i as { q: string; a: string }));
  return <JsonLd data={{ "@type": "FAQPage", mainEntity: list.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />;
}

/* billingIncrement = ISO-Dauer je Abrechnung (z. B. "P4W"); im Schema landet sie als billingDuration, billingIncrement ist dort eine Zahl (4 Wochen). */
export interface OfferSpec { name: string; price: number; description: string; path: string; billingIncrement?: string; category?: string; image?: string }
/** Angebote mit Preis, z. B. START 39 (Abo alle 4 Wochen) oder Tickets (Einmalkauf). */
export function OffersJsonLd({ offers }: { offers: readonly OfferSpec[] }) {
  return (
    <>
      {offers.map(o => (
        <JsonLd key={o.name} data={{
          "@type": "Product", name: o.name, description: o.description, url: SITE_URL + o.path, image: SITE_URL + (o.image || "/img/og.jpg"), brand: { "@type": "Brand", name: "SKILL CGN" }, category: o.category || "Fitnessstudio",
          offers: { "@type": "Offer", url: SITE_URL + o.path, price: o.price, priceCurrency: "EUR", availability: "https://schema.org/InStock", seller: { "@id": SITE_URL + "/#org" },
            ...(o.billingIncrement ? { priceSpecification: { "@type": "UnitPriceSpecification", price: o.price, priceCurrency: "EUR", billingDuration: o.billingIncrement, billingIncrement: 4, unitCode: "WEE" } } : {}),
            description: o.description },
        }} />
      ))}
    </>
  );
}
