/*
 * /checkout?offer=mitgliedschaft|unlimited: Abschluss für SKILL Mitgliedschaft und SKILL Unlimited.
 * Laufzeit 12 Monate oder monatlich als Umschalter, Preis wechselt live (rate-bundle, Fallback OFFERS). Express-Weg (Wallet) und SEPA-Weg wie bei START 39.
 * Zusammenfassung vor der Unterschrift: Tarif, Laufzeit, Preis, Classes, Parken (StartCheckout summary).
 * Alte Angebote (classic, performance, elite) und start39 leiten um. Noindex.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowDown, Check, MapPin, ShieldCheck } from "lucide-react";
import StartCheckout from "@/components/StartCheckout";
import ExpressCheckout from "@/components/ExpressCheckout";
import { usePageMeta } from "@/lib/meta";
import { consent, track, CONSENT_EVENT, openCookieSettings } from "@/lib/pixel";
import { OFFERS, WHATSAPP, type OfferKey } from "@/lib/magicline";
import { useRateBundles, offerBundle, offerTerm, offerPrice, fmtPrice } from "@/lib/useRateBundles";
import { tarif, parkingLabel } from "@/lib/tarife";

const LOGO_WHITE = "/img/manus/skill-cgn-original-white_18b77f12.svg";
type Months = 1 | 12;
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";

export default function Checkout() {
  const [params] = useSearchParams();
  const raw = (params.get("offer") || "mitgliedschaft").toLowerCase();
  const key: OfferKey = raw === "unlimited" ? "unlimited" : raw === "start39" ? "start39" : "mitgliedschaft";
  const offer = OFFERS[key]; const t = tarif(key);
  usePageMeta(`${offer.title} abschließen — SKILL CGN`, "Vertrag online abschließen. Drei Minuten, alle Konditionen vorab sichtbar.", "noindex,nofollow");
  const { bundles, error } = useRateBundles();
  const [months, setMonths] = useState<Months>(params.get("laufzeit") === "monatlich" ? 1 : 12);
  const term = offerTerm(bundles, key, months);
  const bundleReady = !!offerBundle(bundles, key);
  const price = offerPrice(bundles, key, months) ?? (months === 12 ? offer.prices.year ?? offer.prices.monthly : offer.prices.monthly);

  useEffect(() => {
    let fired = false;
    const fire = () => { if (fired) return; fired = true; track("ViewContent", { content_name: offer.title, content_category: "Membership", value: price, currency: "EUR" }); };
    if (consent() === "accepted") fire();
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 300); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [offer.title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (key === "start39") return <Navigate to="/start39" replace />;

  const laufzeit = months === 12 ? "12 Monate" : "Monatlich kündbar";
  const priceLine = `${fmtPrice(price)} € alle vier Wochen, ${months === 12 ? "12 Monate Laufzeit" : "monatlich kündbar"}, keine Gebühr`;
  const summary = [
    { label: "Tarif", value: offer.title }, { label: "Laufzeit", value: laufzeit },
    { label: "Preis", value: `${fmtPrice(price)} € alle vier Wochen` }, { label: "Classes", value: t.classes },
    { label: "Parken", value: parkingLabel(t.parkingPerWeek) },
  ];
  const options: { months: Months; title: string; copy: string }[] = [
    { months: 12, title: "12 Monate", copy: `${fmtPrice(offerPrice(bundles, key, 12) ?? offer.prices.year ?? 0)} € alle vier Wochen · danach monatlich kündbar` },
    { months: 1, title: "Monatlich", copy: `${fmtPrice(offerPrice(bundles, key, 1) ?? offer.prices.monthly)} € alle vier Wochen · 1 Monat Kündigungsfrist` },
  ];
  const toForm = () => document.getElementById("formular")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="campaign-page bg-black text-white">
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 md:px-10">
          <Link to="/memberships"><img src={LOGO_WHITE} alt="SKILL CGN" className="h-5 w-auto md:h-7" width={160} height={28} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/img/logo-white.svg"; }} /></Link>
          <span className="campaign-mono border border-[#FBFF00] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-[#FBFF00]">Onlineabschluss</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 md:px-10 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-14">
        <div className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <p className={kicker}>{t.tagline}</p>
          <h1 className="campaign-display mt-3 text-6xl uppercase leading-[0.86] md:text-8xl">{key === "unlimited" ? <>SKILL<br /><span className="text-[#FBFF00]">UNLIMITED.</span></> : <>SKILL<br /><span className="text-[#FBFF00]">MITGLIEDSCHAFT.</span></>}</h1>
          <p className="campaign-mono mt-5 text-[11px] uppercase leading-relaxed tracking-[0.14em] text-[#FBFF00] sm:text-xs">{priceLine}</p>

          {/* Laufzeit */}
          <div className="mt-6 grid grid-cols-2 gap-px bg-white/15" role="radiogroup" aria-label="Laufzeit wählen">
            {options.map(o => { const active = months === o.months; return (
              <button key={o.months} type="button" role="radio" aria-checked={active} onClick={() => setMonths(o.months)} className={`campaign-button flex min-h-[84px] flex-col items-start justify-center p-4 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>
                <span className="campaign-display text-3xl leading-none">{o.title}</span>
                <span className={`mt-1.5 text-[11px] leading-snug ${active ? "text-black/70" : "text-white/55"}`}>{o.copy}</span>
              </button>
            ); })}
          </div>
          <p className="campaign-display mt-5 text-5xl leading-none text-[#FBFF00] md:text-6xl">{fmtPrice(price)} €<span className="campaign-mono ml-3 align-middle text-[11px] uppercase tracking-[0.16em] text-white/60">alle vier Wochen</span></p>

          <ul className="mt-6 space-y-2">
            {[t.gym, t.classes, t.scan, t.plan, ...(t.coachTalk ? [t.coachTalk] : []), parkingLabel(t.parkingPerWeek), "Keine Gebühr"].map(b => <li key={b} className="flex items-center gap-3 text-sm font-bold text-white/90 md:text-base"><span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-3 w-3 text-black" /></span>{b}</li>)}
          </ul>
          <button type="button" onClick={toForm} className="campaign-button mt-6 flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white lg:hidden">Jetzt abschließen <ArrowDown className="h-4 w-4" /></button>
          <p className="mt-6 text-xs leading-relaxed text-white/45">Vertragsbeginn frei wählbar. 14 Tage Widerruf beim Onlineabschluss. Fragen? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">WhatsApp</a>. <Link to="/memberships" className="underline hover:text-white">Alle Tarife vergleichen</Link>.</p>
        </div>

        <section id="formular" className="mt-8 scroll-mt-4 lg:mt-0">
          {error ? (
            <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-6"><div className="flex items-start gap-4"><ShieldCheck className="h-7 w-7 shrink-0 text-[#FBFF00]" /><div><p className="font-bold uppercase tracking-[0.12em]">Angebot gerade nicht erreichbar</p><p className="mt-3 text-sm leading-relaxed text-white/60">Das Mitgliedersystem antwortet nicht. Bitte lade die Seite neu oder schreib uns per WhatsApp.</p></div></div></div>
          ) : bundles && !bundleReady ? (
            <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-6 md:p-8"><div className="flex items-start gap-4"><ShieldCheck className="h-7 w-7 shrink-0 text-[#FBFF00]" /><div>
              <p className="font-bold uppercase tracking-[0.12em]">Angebot wird gerade eingerichtet</p>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{offer.title} wird gerade im Mitgliedersystem angelegt. Bis dahin schließen wir deinen Vertrag persönlich ab: Schreib uns per WhatsApp mit dem Tarif und deiner Wunschlaufzeit, wir melden uns am selben Tag.</p>
              <a href={`${WHATSAPP}?text=${encodeURIComponent(`Hallo, ich möchte ${offer.title} (${laufzeit}) abschließen.`)}`} target="_blank" rel="noopener noreferrer" className="campaign-button mt-6 inline-flex min-h-12 items-center gap-3 bg-[#FBFF00] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black hover:bg-white">{offer.title} per WhatsApp anfragen</a>
            </div></div></div>
          ) : (
            <>
              <ExpressCheckout term={term} offerName={offer.title} path="/checkout" months={months} priceLine={priceLine} />
              <StartCheckout key={`${key}-${months}`} term={term} offerName={offer.title} path="/checkout" months={months} priceLine={priceLine} summary={summary} cancelNote={months === 12 ? "12 Monate Laufzeit, danach monatlich kündbar. Erste Abbuchung zum Startdatum." : "Monatlich kündbar. Erste Abbuchung zum Startdatum."} />
            </>
          )}
        </section>
      </div>

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-5 py-8 text-[11px] text-white/40 md:flex-row md:items-center md:justify-between md:px-10">
          <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#FBFF00]" /> SKILL CGN · Herzogstraße 16–20 · 50667 Köln</span>
          <span className="campaign-mono flex flex-wrap gap-4 uppercase tracking-[0.16em]"><Link to="/impressum" className="hover:text-white">Impressum</Link><Link to="/datenschutz" className="hover:text-white">Datenschutz</Link><Link to="/agb" className="hover:text-white">AGB</Link><button type="button" onClick={openCookieSettings} className="uppercase hover:text-white">Cookie-Einstellungen</button></span>
        </div>
      </footer>
    </main>
  );
}
