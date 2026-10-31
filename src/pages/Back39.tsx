/*
 * BACK 39: gleiche Abschlussstruktur wie /start39 (src/components/CampaignLanding.tsx), für ehemalige Mitglieder.
 * 39 € alle vier Wochen, dauerhaft, 0 € Aktivierungsgebühr. Laufzeitwahl monatlich oder zwölf Monate (Reboots Bonus) über dem Formular.
 * Preise aus dem rate-bundle "BACK 39". Fehlt es in Magicline: WhatsApp-Platzhalter statt Formular. Noindex, nur per Link.
 */
import { useEffect, useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import CampaignLanding from "@/components/CampaignLanding";
import StartCheckout from "@/components/StartCheckout";
import { useResume } from "@/pages/Start39";
import { usePageMeta } from "@/lib/meta";
import { consent, track, CONSENT_EVENT } from "@/lib/pixel";
import { WHATSAPP } from "@/lib/magicline";
import { useRateBundles, findBundle, termForMonths, fmtPrice } from "@/lib/useRateBundles";

const BUNDLE_NAMES = ["BACK TO SKILL", "BACK 39"];
const WHATSAPP_BACK = `${WHATSAPP}?text=${encodeURIComponent("Hallo, ich war SKILL Mitglied und möchte BACK 39 buchen.")}`;
type Months = 1 | 12;

const forYou = [
  "Du warst SKILL Mitglied und hast nach dem Umzug den Faden verloren.",
  "Du willst zurück in deine Routine, ohne wieder bei null anzufangen.",
  "Du willst wissen, wo du heute stehst. Der 3D Scan zeigt es dir.",
] as const;
const faqs = [
  ["Was kostet die Mitgliedschaft?", "39 € alle vier Wochen, monatlich kündbar, keine Gebühr. 39 € bleiben 39 €, keine Preiserhöhung."],
  ["Wer kann BACK 39 buchen?", "Alle, die schon einmal SKILL Mitglied waren. Keine Neukundenprüfung. Bei Fragen zu deiner alten Mitgliedschaft schreib uns kurz per WhatsApp."],
  ["Welche Laufzeit wähle ich?", "Über dem Formular: monatlich kündbar mit einem Monat Erstlaufzeit und einem Monat Kündigungsfrist, oder zwölf Monate mit Bonus."],
  ["Was ist der Bonus bei zwölf Monaten?", "Vier Reboots Recovery Einheiten à 30 Minuten pro Monat, inklusive. Kompression für die Beine nach der Class oder nach einem langen Tag."],
  ["Wo seid ihr jetzt?", "Herzogstraße 16–20, 50667 Köln, mitten in der Innenstadt. Wir sind umgezogen, nicht geschlossen."],
] as const;

export default function Back39() {
  usePageMeta("BACK 39 — SKILL CGN", "Willkommen zurück. 39 € alle vier Wochen, monatlich kündbar, keine Gebühr. Nur für ehemalige Mitglieder, kostenloser 3D Scan.", "noindex,nofollow");
  const { bundles, error } = useRateBundles();
  const bundle = BUNDLE_NAMES.map(n => findBundle(bundles, n)).find(Boolean) ?? null;
  const [months, setMonths] = useState<Months>(1);
  const termMonthly = termForMonths(bundle, 1);
  const termYear = termForMonths(bundle, 12);
  const term = months === 12 ? termYear : termMonthly;
  const bundleReady = !!bundle && !!termMonthly;
  const price = fmtPrice(term?.price ?? termMonthly?.price ?? 39);
  const resume = useResume();
  useEffect(() => { if (resume?.months === 12) setMonths(12); }, [resume]);

  useEffect(() => {
    let fired = false;
    const fire = () => { if (fired) return; fired = true; track("ViewContent", { content_name: "BACK 39", content_category: "Membership", value: 39, currency: "EUR" }); };
    if (consent() === "accepted") fire();
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 300); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  const options: { months: Months; title: string; copy: string; bonus?: string }[] = [
    { months: 1, title: "Monatlich", copy: "1 Monat Erstlaufzeit · 1 Monat Kündigungsfrist" },
    { months: 12, title: "12 Monate", copy: "Gleicher Preis, Kündigungsfrist zum Ende", bonus: "4 × Reboots Recovery pro Monat" },
  ];
  const toggle = bundleReady ? (
    <div className="mb-3 grid grid-cols-2 gap-px bg-white/15" role="radiogroup" aria-label="Laufzeit wählen">
      {options.map(o => { const active = months === o.months; return (
        <button key={o.months} type="button" role="radio" aria-checked={active} onClick={() => setMonths(o.months)} className={`campaign-button flex min-h-[72px] items-start gap-2 p-3 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white"}`}>
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border-2 ${active ? "border-black bg-black text-[#FBFF00]" : "border-white/40"}`}>{active && <Check className="h-2.5 w-2.5" />}</span>
          <span className="min-w-0"><span className="block text-sm font-bold uppercase tracking-[0.08em]">{o.title}</span><span className={`mt-1 block text-[11px] leading-snug ${active ? "text-black/70" : "text-white/55"}`}>{o.copy}</span>{o.bonus && <span className={`mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] ${active ? "text-black" : "text-[#FBFF00]"}`}>Bonus: {o.bonus}</span>}</span>
        </button>
      ); })}
    </div>
  ) : null;

  const form = error ? (
    <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-6"><div className="flex items-start gap-4"><ShieldCheck className="h-7 w-7 shrink-0 text-[#FBFF00]" /><div><p className="font-bold uppercase tracking-[0.12em]">Angebot gerade nicht erreichbar</p><p className="mt-3 text-sm leading-relaxed text-white/60">Das Mitgliedersystem antwortet nicht. Lade die Seite neu oder schreib uns per WhatsApp.</p></div></div></div>
  ) : !bundles ? (
    <div className="border border-white/10 bg-[#1a2224] p-6"><p className="campaign-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Angebot wird geladen …</p></div>
  ) : !bundleReady ? (
    <div className="border-2 border-[#FBFF00] bg-[#2A3133] p-6"><div className="flex items-start gap-4"><ShieldCheck className="h-7 w-7 shrink-0 text-[#FBFF00]" /><div>
      <p className="font-bold uppercase tracking-[0.12em]">Angebot wird gerade eingerichtet</p>
      <p className="mt-3 text-sm leading-relaxed text-white/60">BACK 39 wird gerade im Mitgliedersystem angelegt. Bis dahin machen wir deinen Vertrag persönlich: Schreib uns per WhatsApp mit dem Stichwort „BACK 39“ und deiner Wunschlaufzeit.</p>
      <a href={WHATSAPP_BACK} target="_blank" rel="noopener noreferrer" className="campaign-button mt-5 inline-flex min-h-12 items-center gap-3 bg-[#FBFF00] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black hover:bg-white">BACK 39 per WhatsApp anfragen <ArrowRight className="h-4 w-4" /></a>
    </div></div></div>
  ) : (
    <>
      <StartCheckout term={term} offerName="BACK 39" path="/back39" months={months} priceLine={`${price} € alle vier Wochen, ${months === 12 ? "12 Monate + Recovery Bonus" : "monatlich kündbar"}, keine Gebühr`} resume={resume} />
    </>
  );

  return (
    <CampaignLanding
      campaign="BACK 39"
      badge="Nur für ehemalige Mitglieder"
      headline="BACK FOR 39€."
      subline="Willkommen zurück."
      priceLine={`${price} € alle vier Wochen · monatlich kündbar · 0 € Gebühr`}
      bullets={["Coach in jeder Class.", "3D Körperscan zum Start.", "Plan mit deinem Namen."]}
      cta="Jetzt starten"
      forYou={forYou}
      coachQuote="Beim Umzug haben wir den Kontakt zu vielen von euch verloren. Das war unser Fehler. Das neue Studio steht, und ich würde dich gern wiedersehen."
      faqs={faqs}
      beforeForm={toggle}
      form={form}
    />
  );
}
