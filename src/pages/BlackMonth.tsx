/*
 * /blackmonth: Aktion ONLY GYM, 6 Monate Gym für 149 € Einmalzahlung, buchbar 2.11. bis 30.11.2026.
 * Zahlung über einen Stripe Payment Link (Karte, Apple Pay, SEPA), Link aus VITE_STRIPE_LINK_BLACKMONTH; ohne Link WhatsApp-Anfrage.
 * Nach der Zahlung legt der Stripe-Webhook den Interessenten in Magicline an (Notiz "Black Month 6 Monate Gym 149 € bezahlt")
 * und schickt die Bestätigung per Resend. Texte und Grafiken sind vorläufig (Platzhalter bis Boris liefert).
 * Außerhalb des Aktionszeitraums zeigt die Seite "Aktion beendet" statt des Kaufknopfs. Noindex, bis die finalen Texte da sind.
 */
import { useEffect } from "react";
import { ArrowRight, Check, Clock, MessageCircle, ShieldCheck } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { track, trackOnce } from "@/lib/pixel";
import { utmParams } from "@/lib/events";
import { WHATSAPP } from "@/lib/magicline";
import { findProduct, shopPrice } from "@/lib/shop";

export const BLACK_MONTH = { start: "2026-11-02", end: "2026-11-30", price: 149, months: 6 } as const;
const inPeriod = (d = new Date()) => { const iso = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); return iso >= BLACK_MONTH.start && iso <= BLACK_MONTH.end; };
const before = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) < BLACK_MONTH.start;
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";

const FACTS = [
  "6 Monate Gym in der Herzogstraße 16–20, Köln",
  "149 € einmalig, keine Folgekosten, kein Abo",
  "Nur Gym, keine Classes",
  "Buchbar vom 2. bis 30. November 2026",
] as const;
const FAQ = [
  ["Was ist drin?", "Sechs Monate Training im Gym bei SKILL CGN. Classes sind nicht enthalten, die gibt es über Drop In, Trial Pass oder eine Mitgliedschaft."],
  ["Wann startet mein Zugang?", "Nach der Zahlung melden wir uns per E-Mail mit den nächsten Schritten. Der Zugang startet mit deinem ersten Besuch im Studio."],
  ["Verlängert sich das automatisch?", "Nein. 149 € einmal, nach sechs Monaten endet der Zugang von selbst."],
  ["Wie bezahle ich?", "Sicher über Stripe mit Karte, Apple Pay oder SEPA-Lastschrift. Die Rechnung kommt von Stripe per E-Mail."],
] as const;

export default function BlackMonth() {
  usePageMeta("Black Month: 6 Monate Gym für 149 € — SKILL CGN Köln", "ONLY GYM. Sechs Monate Gym in der Kölner Innenstadt für 149 € Einmalzahlung. Nur vom 2. bis 30. November 2026.", "noindex,nofollow");
  const product = findProduct("black-month");
  const link = product?.paymentLink || "";
  const active = inPeriod();
  useEffect(() => { setTimeout(() => trackOnce("vc-blackmonth", "ViewContent", { content_name: "Black Month", content_category: "Aktion", value: BLACK_MONTH.price, currency: "EUR", ...utmParams() }), 300); }, []);
  const buy = () => { track("InitiateCheckout", { content_name: "Black Month", content_category: "Aktion", value: BLACK_MONTH.price, currency: "EUR", ...utmParams() }); };
  const waText = encodeURIComponent("Hi, ich möchte Black Month buchen: 6 Monate Gym für 149 €.");

  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <section className="campaign-grid border-b border-white/10">
        <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8 md:py-24 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:items-center">
          <div>
            <p className={kicker}>Aktion · 2. bis 30. November 2026</p>
            <h1 className="campaign-display mt-4 text-[72px] uppercase leading-[0.82] sm:text-[96px] md:text-[128px]">Black<br /><span className="text-[#FBFF00]">Month.</span></h1>
            <p className="campaign-display mt-4 text-3xl uppercase leading-none text-white/85 md:text-5xl">Only Gym. 6 Monate. 149 €.</p>
            <p className="campaign-mono mt-5 text-[11px] uppercase tracking-[0.14em] text-[#FBFF00]">Einmalzahlung · kein Abo · keine Folgekosten</p>
            <ul className="mt-6 space-y-2">
              {FACTS.map(f => <li key={f} className="flex items-center gap-3 text-sm font-bold text-white/90 md:text-base"><span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-3 w-3 text-black" /></span>{f}</li>)}
            </ul>
            <div className="mt-8">
              {active && link ? (
                <a href={link} onClick={buy} className="campaign-button inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white lg:w-auto">Jetzt sichern, {BLACK_MONTH.price} € einmalig <ArrowRight className="h-4 w-4" /></a>
              ) : active ? (
                <a href={`${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" onClick={buy} className="campaign-button inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white lg:w-auto"><MessageCircle className="h-4 w-4" /> Per WhatsApp sichern</a>
              ) : (
                <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-5"><p className="flex items-center gap-2 text-sm font-bold"><Clock className="h-4 w-4 text-[#FBFF00]" /> {before() ? "Die Aktion startet am 2. November 2026." : "Die Aktion ist beendet."}</p><p className="mt-2 text-xs text-white/60">Fragen? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline text-[#FBFF00]">WhatsApp</a></p></div>
              )}
              <p className="campaign-mono mt-3 text-[10px] uppercase tracking-[0.16em] text-white/45">Sicher bezahlen per Karte, Apple Pay oder SEPA · Stripe</p>
            </div>
          </div>
          <div className="mt-10 lg:mt-0">
            {/* Platzhalter für das Kampagnenmotiv, kommt von Boris */}
            <div className="relative aspect-[4/5] w-full border border-[#FBFF00]/40 bg-[#111516]">
              <div className="absolute inset-0 flex flex-col items-start justify-end p-6">
                <span className="campaign-display text-[26vw] leading-[0.8] text-white/5 lg:text-[14rem]">149</span>
                <p className={kicker}>Motiv folgt</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#111516] py-14 md:py-20">
        <div className="mx-auto max-w-[1180px] px-5 md:px-8">
          <p className={kicker}>So läuft es</p>
          <ol className="mt-6 grid gap-px bg-white/15 md:grid-cols-3">
            {[["Bezahlen", "149 € einmal über Stripe, mit Karte, Apple Pay oder SEPA."], ["Bestätigung", "Du bekommst sofort eine E-Mail, wir legen dich in unserem Mitgliedersystem an."], ["Trainieren", "Komm vorbei, wir richten dich am Empfang ein. Sechs Monate Gym ab deinem ersten Besuch."]].map(([t, x], i) => (
              <li key={t} className="bg-[#2A3133] p-6"><span className="campaign-mono text-[10px] text-white/35">0{i + 1}</span><h2 className="campaign-display mt-3 text-2xl uppercase">{t}</h2><p className="mt-2 text-sm leading-relaxed text-white/65">{x}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <p className={kicker}>Fragen</p>
          <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {FAQ.map(([q, a]) => <div key={q} className="py-5"><dt className="text-base font-bold">{q}</dt><dd className="mt-2 text-sm leading-relaxed text-white/65">{a}</dd></div>)}
          </dl>
          <p className="mt-8 flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="h-4 w-4 text-[#FBFF00]" /> {product ? `${product.name}, ${shopPrice(product.price)} inkl. MwSt.` : "149 € inkl. MwSt."} SKILL CGN, Impetus Kraftkonzept UG, Herzogstraße 16–20, 50667 Köln.</p>
        </div>
      </section>
    </main>
  );
}
