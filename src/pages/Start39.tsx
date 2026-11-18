/*
 * START 39: reine Abschlussseite. Preis, Vertrauen und Formular in den ersten zwei Bildschirmen, Rest darunter.
 * Struktur in src/components/CampaignLanding.tsx, Formular in src/components/StartCheckout.tsx. Preise live aus dem rate-bundle.
 * ?resume=TOKEN aus der Erinnerungsmail stellt Schritt 1 wieder her und startet in Schritt 2.
 * Über dem Formular der Express-Abschluss (Apple Pay, Google Pay, Link) aus src/components/ExpressCheckout.tsx, nur sichtbar mit Wallet auf dem Gerät.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import CampaignLanding from "@/components/CampaignLanding";
import StartCheckout, { type ResumeData } from "@/components/StartCheckout";
import { usePageMeta } from "@/lib/meta";
import { consent, track, CONSENT_EVENT } from "@/lib/pixel";
import { useRateBundles, findBundle, fmtPrice } from "@/lib/useRateBundles";
import { START39_TERM_ID } from "@/lib/magicline";
import { START39_OFFER, START39_RULE, PARKING } from "@/lib/tarife";
import { FaqJsonLd, OffersJsonLd } from "@/lib/jsonld";
import { Link } from "react-router-dom";

const forYou = [
  "Du trainierst seit Monaten und siehst nichts.",
  "Du hast HYROX im Kalender und brauchst einen Plan.",
  "Du warst noch nie im Gym und willst es diesmal richtig machen.",
] as const;
const faqs = [
  ["Was kostet die Mitgliedschaft?", `${START39_OFFER} Keine Aufnahmegebühr statt 89 €. ${START39_RULE}`],
  ["Wie lange läuft der Vertrag?", "1 Monat Mindestlaufzeit, verlängert sich automatisch um jeweils 1 Monat zu 39 €, kündbar mit 1 Monat Frist zum Laufzeitende. Abgerechnet wird alle vier Wochen. 14 Tage Widerruf beim Onlineabschluss."],
  ["Gibt es eine Aufnahmegebühr?", "Nein. Regulär 89 €, bei START 39 entfällt sie."],
  ["Was ist drin?", "Volles Gym, vier gecoachte Classes im Monat, Getränke an der Wasserbar, Duschen, Trainingshandtuch, der Scaneca 3D Scan zum Start mit Auswertung und ein Plan mit deinem Namen. Keine Aufnahmegebühr statt 89 €. Parken ist in START 39 nicht enthalten, ab der SKILL Mitgliedschaft ist es inklusive."],
  ["Wer kann START 39 buchen?", "Volljährige Neukunden ohne aktive oder zukünftige SKILL-Mitgliedschaft, nur online. Das prüfen wir vor der Vertragsanlage."],
  [PARKING.faqQ, `In START 39 nicht. ${PARKING.faqA}`],
  ["Hat SKILL Cologne geschlossen?", "Nein. Wir sind im Mai in die Herzogstraße 16 bis 20 umgezogen, zwei Minuten vom Neumarkt, und haben täglich geöffnet."],
] as const;

/** Wiederherstellung aus der Erinnerungsmail (?resume=TOKEN) */
export function useResume(): ResumeData | null {
  const [params] = useSearchParams();
  const token = params.get("resume") || "";
  const [data, setData] = useState<ResumeData | null>(null);
  useEffect(() => {
    if (!/^[a-z0-9]{16,48}$/.test(token)) return;
    fetch(`/api/checkout-lead?token=${encodeURIComponent(token)}`).then(r => (r.ok ? r.json() : null)).then(j => { if (j?.email) setData({ token, ...j }); }).catch(() => {});
  }, [token]);
  return data;
}

export default function Start39() {
  usePageMeta("START 39: Fitnessstudio in Köln für 39 € je 4 Wochen — SKILL CGN", "Fitnessstudio Köln, Neumarkt: 39 € je 4 Wochen, 4 Classes im Monat, monatlich kündbar, keine Aufnahmegebühr statt 89 €, 3D Scan inklusive. Nur online, nur Neukunden.");
  const { bundles, error } = useRateBundles();
  const bundle = findBundle(bundles, "START 39");
  const term = bundle?.terms?.find(t => t.id === START39_TERM_ID) ?? bundle?.terms?.find(t => t.termUnit === "MONTH" && t.termValue === 1) ?? null;
  const resume = useResume();

  /* ViewContent nur mit Consent: sofort, wenn schon erteilt, sonst beim Erteilen auf dieser Seite */
  useEffect(() => {
    let fired = false;
    /* Der Pixel lädt erst im Cookie-Banner (nach dieser Seite), daher kurz warten, bis fbq da ist (vorher verpuffte ViewContent) */
    const fire = () => { if (fired) return; fired = true; let tries = 0; const send = () => { if (window.fbq) track("ViewContent", { content_name: "START 39", content_category: "Membership", value: 39, currency: "EUR" }); else if (++tries < 20) setTimeout(send, 300); }; send(); };
    if (consent() === "accepted") fire();
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 300); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  const price = fmtPrice(term?.price ?? 39);
  return (
    <>
    <FaqJsonLd items={faqs} />
    <OffersJsonLd offers={[{ name: "START 39", price: 39, path: "/start39", billingIncrement: "P4W", description: "4 Classes im Monat, monatlich kündbar, keine Aufnahmegebühr statt 89 €" }]} />
    <CampaignLanding
      campaign="START 39"
      h1Sub="Fitnessstudio in Köln · 39 € je 4 Wochen"
      headline="START FOR 39€."
      subline="Dein Coach. Dein Plan."
      priceLine={`${price} € je 4 Wochen · monatlich kündbar · keine Aufnahmegebühr statt 89 € · nur online, nur Neukunden`}
      priceNote={<><span className="font-bold text-white">{START39_OFFER}</span> {START39_RULE} Kein Parken in START 39, <Link to="/memberships#parken" className="underline hover:text-[#FBFF00]">Parken ist ab der SKILL Mitgliedschaft inklusive</Link>.</>}
      bullets={["Gym.", "4 Classes im Monat, Coach in jeder Class.", "3D Scan zum Start.", "Plan mit deinem Namen.", "Getränke, Dusche und Handtuch inklusive."]}
      included={[
        { label: "Volles Gym", sub: "Freibereich und Kraftgeräte von Technogym" },
        { label: "4 Classes im Monat", sub: "Coach in jeder Class" },
        { label: "Getränke", sub: "Wasser und Mineraldrinks, zuckerfrei" },
        { label: "Duschen und Handtuch", sub: "Trainingshandtuch inklusive" },
        { label: "3D Scan zum Start", sub: "Körperfett, Muskelmasse, Haltung. Dein Before-and-After." },
        { label: "Plan mit deinem Namen", sub: "Vom Coach geschrieben" },
        { label: "Monatlich kündbar", sub: "1 Monat Mindestlaufzeit", wide: true },
      ]}
      feeNote={{ label: "Aufnahmegebühr", now: "0 €", was: "89 €" }}
      cta="Jetzt starten"
      forYou={forYou}
      coachQuote="Progression vor Perfektion. Mit effektivem und effizientem Programming bringe ich jeden Kunden zum Ziel."
      faqs={faqs}
      form={error ? (
        <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-6">
          <div className="flex items-start gap-4"><ShieldCheck className="h-7 w-7 shrink-0 text-[#FBFF00]" /><div><p className="font-bold uppercase tracking-[0.12em]">Angebot gerade nicht erreichbar</p><p className="mt-3 text-sm leading-relaxed text-white/60">Das Mitgliedersystem antwortet nicht. Lade die Seite neu oder schreib uns per WhatsApp.</p></div></div>
        </div>
      ) : (
        <>
          <StartCheckout term={term} offerName="START 39" path="/start39" priceLine={`${price} € je 4 Wochen, monatlich kündbar, keine Aufnahmegebühr statt 89 €`} resume={resume}
            summary={[{ label: "Tarif", value: "START 39" }, { label: "Laufzeit", value: "1 Monat, verlängert sich um je 1 Monat" }, { label: "Preis", value: `${price} € je 4 Wochen` }, { label: "Aufnahmegebühr", value: "0 € statt 89 €" }, { label: "Kündigung", value: "1 Monat Frist zum Laufzeitende" }, { label: "Classes", value: "4 Classes im Monat" }, { label: "Parken", value: "Kein Parken" }]}
            cancelNote="Nur für Neukunden. 1 Monat Mindestlaufzeit, verlängert sich automatisch um jeweils 1 Monat zu 39 €, kündbar mit 1 Monat Frist zum Laufzeitende. Erste Abbuchung zum Startdatum." />
        </>
      )}
    />
    </>
  );
}
