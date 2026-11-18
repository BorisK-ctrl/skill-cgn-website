/*
 * /blackmonth: BLACK MONTH, 6 Monate Gym für 149 € Einmalzahlung (Aktion 2. bis 30.11.2026, Start bis 15.12.2026).
 * Einfachste Version, Texte von Boris (2026-11-01). Kaufknopf führt direkt auf den Stripe Payment Link; UTM-Parameter der eingehenden URL
 * werden als client_reference_id (kompakt, max. 200 Zeichen) und zusätzlich als utm_* in der Link-URL weitergegeben.
 * Kauf-Event (Meta, Google) feuert erst auf /blackmonth/danke, hier nur ViewContent und InitiateCheckout.
 * Hero-Überschrift und Unterzeile wechseln clientseitig je utm_content (bm04_sled_25eur, bm05_strength_6monate), sonst Standard (bm01_rack).
 * Zweiter Weg ohne Zahlung: "Erst anschauen, 10 Minuten" per WhatsApp an Boris. Ab 1.12. leitet die Seite auf die Startseite.
 */
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Check, MessageCircle, Star, X } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { track, trackOnce } from "@/lib/pixel";
import { trackCta, utmParams } from "@/lib/events";
import { WHATSAPP } from "@/lib/magicline";
import { BLACK_MONTH, blackMonthActive, HERO_DEFAULT, heroVariant } from "@/lib/blackmonth";

export { BLACK_MONTH };
const WA_LOOK = `${WHATSAPP}?text=${encodeURIComponent("Hi Boris, ich will mir SKILL für Black Month kurz anschauen. Wann passt es?")}`;
const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/place/Skill+Cologne/@50.9371,6.9497,17z/data=!4m8!3m7!1s0x47bf259a5f555b25:0xa5bcfa4e61b6fe6!8m2!3d50.9371!4d6.9497!9m1!1b1!16s%2Fg%2F11j2y0ggb8";
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";
const h2 = "campaign-display text-4xl uppercase leading-none md:text-5xl";

const POINTS = ["Unter 25 € im Monat.", "Komplettes Gym in Köln-Mitte, Herzogstraße 16.", "Start, wann du willst, spätestens 15.12."] as const;
const IN = ["Gym komplett", "Dusche", "6 Monate ab deinem ersten Trainingstag"] as const;
const OUT = ["Classes", "Coaching"] as const;
const FAQ = [
  ["Was ist drin?", "Das komplette Gym in der Herzogstraße 16, Dusche inklusive, sechs Monate lang ab deinem ersten Trainingstag."],
  ["Was ist nicht drin?", "Classes und Coaching. Dafür gibt es Drop In, Trial Pass oder eine Mitgliedschaft."],
  ["Was passiert nach 6 Monaten?", "Nichts. Dein Zugang endet von allein, es gibt keine Verlängerung und keine Folgekosten."],
  ["Kann ich pausieren oder kündigen?", "Nein, dafür ist der Preis. 149 € einmal, sechs Monate am Stück."],
  ["Wie zahle ich?", "Online mit Karte oder Apple Pay über Stripe. Im Studio per Lastschrift."],
  ["Widerruf", "Du hast 14 Tage Widerrufsrecht ab Kauf. Details in den AGB unter skill-studios.com/agb."],
] as const;

/** Stripe-Link mit UTM-Weitergabe: client_reference_id = kompakte Quelle (nur a-z, 0-9, _ -), zusätzlich utm_* in der URL. */
export function stripeLinkWithUtm(base: string, utm: Record<string, string>): string {
  const u = new URL(base);
  const parts = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map(k => utm[k]).filter(Boolean).map(v => v.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40));
  const ref = (parts.length ? parts.join("__") : "direct").slice(0, 200);
  u.searchParams.set("client_reference_id", ref);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) if (utm[k]) u.searchParams.set(k, utm[k].slice(0, 100));
  return u.toString();
}

export default function BlackMonth() {
  usePageMeta("Black Month: 6 Monate Gym für 149 € — SKILL CGN Köln", "BLACK MONTH bei SKILL CGN: 6 Monate Gym in Köln-Mitte für 149 €, einmal zahlen, kein Abo, endet von allein. Nur vom 2. bis 30.11.2026, nur für Neukunden.", "index,follow", "/img/og-blackmonth.jpg");
  // Prerender zeigt immer die Aktion; im Browser entscheidet das Berliner Datum (kein Flackern durch Hydration-Mismatch). Nach dem 30.11.: Startseite.
  const [active, setActive] = useState(!BLACK_MONTH.ended);
  useEffect(() => { setActive(blackMonthActive()); }, []);
  // Überschrift je Anzeige, erst nach dem Mount (der Prerender kennt keine Query).
  const [hero, setHero] = useState(HERO_DEFAULT);
  useEffect(() => { setHero(heroVariant()); }, []);
  // Link erst nach dem Mount mit UTM anreichern: React übernimmt bei der Hydration das href aus dem Prerender, ein useMemo würde verpuffen.
  const [link, setLink] = useState(() => stripeLinkWithUtm(BLACK_MONTH.link, {}));
  useEffect(() => { setLink(stripeLinkWithUtm(BLACK_MONTH.link, utmParams())); }, []);
  useEffect(() => { setTimeout(() => trackOnce("vc-blackmonth", "ViewContent", { content_name: "Black Month", content_category: "Aktion", value: BLACK_MONTH.price, currency: "EUR", ...utmParams() }), 300); }, []);
  const buy = () => track("InitiateCheckout", { content_name: "Black Month", content_category: "Aktion", value: BLACK_MONTH.price, currency: "EUR", ...utmParams() });

  if (!active) return <Navigate to="/" replace />;
  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <section className="campaign-grid border-b border-white/10">
        <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8 md:py-24">
          <p className={kicker}>Nur vom 2. bis 30.11.2026</p>
          <h1 className="campaign-display mt-4 text-[64px] uppercase leading-[0.85] sm:text-[88px] md:text-[120px]">{hero.title[0]}<br /><span className="text-[#FBFF00]">{hero.title[1]}</span>{hero.title[2] && <><br />{hero.title[2]}</>}</h1>
          <p className="campaign-display mt-5 text-2xl uppercase leading-none text-white/85 md:text-4xl">{hero.subline}</p>
          <ul className="mt-7 space-y-3">
            {POINTS.map(p => <li key={p} className="flex items-center gap-3 text-base font-bold md:text-lg"><span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-4 w-4 text-black" /></span>{p}</li>)}
          </ul>
          <div className="mt-8 max-w-xl">
            <a href={link} onClick={buy} className="campaign-button inline-flex min-h-16 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-base font-bold uppercase tracking-[0.14em] text-black hover:bg-white">Jetzt sichern, 149 € <ArrowRight className="h-5 w-5" /></a>
            <a href={WA_LOOK} target="_blank" rel="noopener noreferrer" onClick={() => trackCta("cta_blackmonth_whatsapp")} className="campaign-button mt-3 inline-flex min-h-14 w-full items-center justify-center gap-3 border-2 border-white/30 px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white hover:border-[#FBFF00] hover:text-[#FBFF00]"><MessageCircle className="h-4 w-4" /> Erst anschauen, 10 Minuten</a>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
              <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-[#FBFF00]"><Star className="h-3.5 w-3.5 fill-[#FBFF00] text-[#FBFF00]" /> 4,9 Sterne bei Google</a>
              <span className="text-white/30">·</span><span>14 Tage Widerruf</span>
              <span className="text-white/30">·</span><span>Herzogstraße 16, zwei Minuten vom Neumarkt</span>
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-white/50">Nur vom 2. bis 30.11.2026. Nur für Neukunden. Einmal pro Person. Preis inkl. MwSt.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#111516] py-14 md:py-20">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 md:grid-cols-2 md:px-8">
          <div>
            <p className={kicker}>Was drin ist</p>
            <h2 className={`mt-3 ${h2}`}>Drin.</h2>
            <ul className="mt-5 space-y-3">{IN.map(t => <li key={t} className="flex items-center gap-3 text-base font-bold"><span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-4 w-4 text-black" /></span>{t}</li>)}</ul>
          </div>
          <div>
            <p className={kicker}>Was nicht drin ist</p>
            <h2 className={`mt-3 ${h2}`}>Nicht drin.</h2>
            <ul className="mt-5 space-y-3">{OUT.map(t => <li key={t} className="flex items-center gap-3 text-base font-bold text-white/70"><span className="flex h-6 w-6 shrink-0 items-center justify-center border border-white/40"><X className="h-4 w-4" /></span>{t}</li>)}</ul>
            <p className="mt-4 text-sm text-white/55">Classes und Coaching gibt es über <Link to="/shop" className="underline text-[#FBFF00]">Drop In und Trial Pass</Link> oder eine <Link to="/memberships" className="underline text-[#FBFF00]">Mitgliedschaft</Link>.</p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <p className={kicker}>Fragen</p>
          <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {FAQ.map(([q, a]) => <div key={q} className="py-5"><dt className="text-base font-bold">{q}</dt><dd className="mt-2 text-sm leading-relaxed text-white/65">{a}</dd></div>)}
          </dl>
          <a href={link} onClick={buy} className="campaign-button mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white md:w-auto">Jetzt sichern, 149 € <ArrowRight className="h-4 w-4" /></a>
          <p className="mt-8 text-xs text-white/45">SKILL CGN, Impetus Kraftkonzept UG (haftungsbeschränkt), Herzogstraße 16, 50667 Köln. <Link to="/agb" className="underline">AGB und Widerruf</Link> · <Link to="/impressum" className="underline">Impressum</Link> · <Link to="/datenschutz" className="underline">Datenschutz</Link></p>
        </div>
      </section>
    </main>
  );
}
