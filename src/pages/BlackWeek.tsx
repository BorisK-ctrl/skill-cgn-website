/*
 * /blackweek: Black Week, Gym Only für 29 € alle 4 Wochen (18. bis 30.11.2026). Aufbau wie /start39 (CampaignLanding + StartCheckout), nur SEPA.
 * Angebot 1215762330, Term 1215762340, Preis live aus dem rate-bundle (src/lib/blackweek.ts). Vertragsstart am Abschlusstag, Dankeseite /blackweek/danke.
 * Fehlt das Angebot im rate-bundle (nach dem 30.11.), zeigt die Seite "beendet" statt des Formulars.
 */
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import CampaignLanding from "@/components/CampaignLanding";
import PriceStamp from "@/components/PriceStamp";
import Countdown from "@/components/Countdown";
import StartCheckout from "@/components/StartCheckout";
import { usePageMeta } from "@/lib/meta";
import { consent, track, CONSENT_EVENT } from "@/lib/pixel";
import { useRateBundles, fmtPrice } from "@/lib/useRateBundles";
import { BLACK_WEEK, useBlackWeekCountdown } from "@/lib/blackweek";
import { PARKING } from "@/lib/tarife";
import { WHATSAPP } from "@/lib/magicline";
import { FaqJsonLd, OffersJsonLd } from "@/lib/jsonld";
import { useResume } from "@/pages/Start39";

const forYou = [
  "Du trainierst lieber allein und brauchst keine Classes.",
  "Du willst ein gutes Gym in der Innenstadt, ohne lange Bindung.",
  "Du willst wissen, wo du stehst: 3D Scan und Assessment zum Start.",
] as const;

export default function BlackWeek() {
  usePageMeta("Black Week: Gym Only für 29 € alle 4 Wochen, SKILL CGN Köln", "Black Week bei SKILL CGN in Köln: Gym Only für 29 € alle 4 Wochen, monatlich kündbar, 0 € Aufnahmegebühr. Nur bis 30.11.2026.");
  const { bundles, error } = useRateBundles();
  const bundle = bundles?.find(b => b.id === BLACK_WEEK.rateBundleId) ?? null;
  const term = bundle?.terms?.find(t => t.id === BLACK_WEEK.termId) ?? bundle?.terms?.[0] ?? null;
  const countdown = useBlackWeekCountdown();
  const ended = (!!bundles && !bundle) || countdown.ended;
  const resume = useResume();
  const p = fmtPrice(term?.price ?? BLACK_WEEK.price);
  /* Regulärer Gym-Only-Preis nur für den Hinweis "Nach der Black Week …", kein Streichpreis (Issue #1, § 5 UWG). */

  /* PageView kommt vom Pixel selbst. ViewContent nur mit Consent, sofort oder beim Erteilen auf dieser Seite. */
  useEffect(() => {
    let fired = false;
    /* Der Pixel lädt erst im Cookie-Banner (nach dieser Seite), daher kurz warten, bis fbq da ist */
    const fire = () => { if (fired) return; fired = true; let tries = 0; const send = () => { if (window.fbq) track("ViewContent", { content_name: BLACK_WEEK.pixelName, content_category: "Membership", value: BLACK_WEEK.price, currency: "EUR" }); else if (++tries < 20) setTimeout(send, 300); }; send(); };
    if (consent() === "accepted") fire();
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 300); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  const faqs = [
    ["Was kostet es?", `${p} € alle 4 Wochen, dauerhaft. Kein Preissprung. Abrechnung alle 4 Wochen, das sind 13 Abbuchungen im Jahr.`],
    ["Wie lange läuft der Vertrag?", "Laufzeit 1 Monat, verlängert sich automatisch um jeweils 1 Monat. Kündigungsfrist 1 Monat zum Laufzeitende, Kündigung per Mail reicht."],
    ["Gibt es eine Aufnahmegebühr?", "Nein, keine Aufnahmegebühr."],
    ["Was ist drin?", "Gym komplett, Dusche, Getränke, Trainingshandtuch, 3D Scan und Assessment zum Start."],
    ["Was ist nicht drin?", "Kurse und Coaching. Dafür gibt es Drop In und Trial Pass im Shop."],
    ["Wer kann buchen?", "Alle ab 18 ohne laufenden SKILL Vertrag. Ein Wechsel aus einem laufenden Vertrag ist nicht möglich."],
    ["Bis wann?", `Abschluss bis 30.11.2026. Für dich bleibt es danach dauerhaft bei ${BLACK_WEEK.price} € alle vier Wochen, solange dein Vertrag läuft.`],
    ["Widerruf?", "14 Tage ab Abschluss, Details in den AGB."],
    [PARKING.faqQ, "Parken ist im Black Week Angebot nicht enthalten. Das Parkhaus Brückenstraße liegt zwei Minuten zu Fuß entfernt."],
    ["Wann habt ihr geöffnet?", "Montag bis Donnerstag 7 bis 22 Uhr, Freitag 7 bis 20 Uhr, Samstag und Sonntag 9 bis 20 Uhr. Herzogstraße 16 bis 20, zwei Minuten vom Neumarkt."],
  ] as const;

  const placeholder = (title: string, text: ReactNode) => (
    <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-6">
      <div className="flex items-start gap-4"><ShieldCheck className="h-7 w-7 shrink-0 text-[#FBFF00]" /><div><p className="font-bold uppercase tracking-[0.12em]">{title}</p><p className="mt-3 text-sm leading-relaxed text-white/60">{text}</p></div></div>
    </div>
  );

  return (
    <>
    <FaqJsonLd items={faqs} />
    <OffersJsonLd offers={[{ name: "BLACK WEEK Gym Only", price: BLACK_WEEK.price, path: "/blackweek", billingIncrement: "P4W", description: "Gym Only, monatlich kündbar, 0 € Aufnahmegebühr, Abschluss bis 30.11.2026" }]} />
    <CampaignLanding
      campaign="Gym Only"
      badge="Black Week · bis 30.11."
      h1Sub="Fitnessstudio in Köln · Herzogstraße, zwei Minuten vom Neumarkt"
      headline={`BLACK WEEK.\nGYM ONLY.\n${p}\u00a0€`}
      ctaEarly
      compactIncluded
      accent={`${p}\u00a0€`}
      afterAccent={<PriceStamp />}
      subline={"Alle 4 Wochen. Monatlich kündbar.\n0\u00a0€\u00a0Aufnahmegebühr."}
      video={{ src: "/video/blackweek-boris.mp4", poster: "/video/blackweek-boris-poster.webp", label: "Boris, Founder von SKILL CGN, erklärt den Black Week Deal: Gym Only für 29 € alle 4 Wochen" }}
      priceLine="Nur online · nur Neukunden · Abschluss bis 30.11.2026"
      /* Darstellung nach Boris (19.11.2026). Kein Vergleichspreis: ONLY GYM 34 € ist ein anderer Tarif (3 Monate, Getränke und Handtuch extra),
         39 € gibt es nur als START 39 mit Kursen, selbst ein Angebot. Alles hier ist durch den Magicline-Vertrag 1215762340 gedeckt. */
      priceNote={<><span className="block font-bold text-white">{p}&nbsp;€ alle vier Wochen · dauerhaft</span><span className="block">Monatlich kündbar · 0&nbsp;€ Aufnahmegebühr</span><span className="mt-2 block">Enthalten sind Gym-Zugang und freies Training, Getränke, Duschen, Trainingshandtuch sowie 3D-Körperscan und Assessment zum Start. Kurse und Coaching sind nicht enthalten.</span></>}
      bullets={[]}
      included={[
        { label: "Gym komplett", short: "Gym komplett", sub: "Alle Geräte, Freihantelbereich, Kunstrasenbahn" },
        { label: "Dusche", short: "Dusche", sub: "Duschen und Umkleiden" },
        { label: "Getränke", short: "Getränke", sub: "Wasser und Mineraldrinks" },
        { label: "Trainingshandtuch", short: "Handtuch", sub: "Bei jedem Training" },
        { label: "3D Scan und Assessment", short: "3D Scan zum Start", sub: "Zum Start", wide: true },
        { label: "Monatlich kündbar", short: "Monatlich kündbar", sub: "Laufzeit 1 Monat", wide: true },
      ]}
      feeNote={{ label: "Black Week Preis", now: `${p}\u00a0€` }}
      notIncluded={<><span className="font-bold text-white">Nicht drin: Kurse und Coaching.</span> Dafür gibt es Drop In und Trial Pass im <Link to="/shop" className="underline hover:text-[#FBFF00]">Shop</Link>.</>}
      cta="Jetzt sichern"
      ctaNote="Nur bis 30.11.2026. Nicht für Mitglieder mit laufendem Vertrag. Preis inkl. MwSt."
      stickyLabel={`${p} € alle 4 Wochen`}
      countdown={ended ? "" : countdown.label}
      timer={ended ? null : <Countdown variant="campaign" />}
      forYou={forYou}
      frame={[
        { t: "SCAN ZUM START.", c: "Scaneca 3D-Körperscan und Assessment. Dein Nullpunkt, gemessen, nicht geschätzt." },
        { t: "TRAINING DAZWISCHEN.", c: "Gym komplett: alle Geräte, Freihantelbereich, Kunstrasenbahn. Du trainierst, wann es dir passt." },
        { t: "MONATLICH KÜNDBAR.", c: "Laufzeit 1 Monat, Kündigung per Mail. Du bleibst, solange es dir etwas bringt." },
      ]}
      urbanText="Dann kennst du unsere Classes schon. Gym Only gibt dir, was Urban Sports nicht hat: das Gym mit allen Geräten, so oft du willst, dazu 3D Scan und Assessment zum Start."
      coachQuote="Progression vor Perfektion. Mit effektivem und effizientem Programming bringe ich jeden Kunden zum Ziel."
      faqs={faqs}
      form={error ? placeholder("Angebot gerade nicht erreichbar", <>Das Mitgliedersystem antwortet nicht. Lade die Seite neu oder schreib uns per <a href={WHATSAPP} className="underline">WhatsApp</a>.</>)
        : ended ? placeholder("Black Week ist beendet", <>Das Angebot war bis 30.11.2026 buchbar. Mit Classes und Coach startest du mit <Link to="/start39" className="underline">START 39</Link>.</>)
        : (
          <>
            <StartCheckout term={term} offerName={BLACK_WEEK.offer} path="/blackweek" priceLine={`${p} € alle 4 Wochen, monatlich kündbar, keine Aufnahmegebühr`} resume={resume}
              startToday successPath="/blackweek/danke" utmContent
              notes={{ lead: "BLACK WEEK 29 Website, Schritt 1 abgeschickt", contract: "BLACK WEEK 29 Website, Vertrag abgeschlossen" }}
              summary={[{ label: "Tarif", value: "BLACK WEEK Gym Only" }, { label: "Laufzeit", value: "1 Monat, verlängert sich um je 1 Monat" }, { label: "Preis", value: `${p} € alle 4 Wochen, dauerhaft` }, { label: "Aufnahmegebühr", value: "Keine" }, { label: "Kündigung", value: "1 Monat Frist zum Laufzeitende" }, { label: "Start", value: "Heute, am Tag des Abschlusses" }, { label: "Classes", value: "Nicht enthalten" }]}
              cancelNote={`Nur für Neukunden ohne laufenden SKILL Vertrag. Laufzeit 1 Monat, verlängert sich automatisch um jeweils 1 Monat zu ${p} €, kündbar mit 1 Monat Frist zum Laufzeitende. Erste Abbuchung zum Vertragsstart.`} />
            <p className="campaign-mono mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-white/45">Fragen? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#FBFF00]">WhatsApp</a> · <Link to="/datenschutz" className="underline hover:text-[#FBFF00]">Datenschutz</Link></p>
          </>
        )}
    />
    </>
  );
}
