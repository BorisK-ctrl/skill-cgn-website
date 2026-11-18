/*
 * SKILL CGN — Startseite, auf ein Ziel ausgerichtet: kostenloses Probetraining mit 3D Scan.
 * Positionierung: Dein Coach. Dein Plan. Betreutes Training mit System in der Kölner Innenstadt. HYROX ist Format und Siegel, nicht Spitze.
 * Reihenfolge: Hero, drei Bewertungen, Preise, Probetraining in drei Schritten, Coaches, (Kein normales Gym), Scan-Vergleich (ausgeblendet bis Zahlen da sind),
 * Galerie mit sechs Bildern, Formate als Zeile, Standort und Öffnungszeiten, FAQ, Schlussblock.
 * Preise live aus dem Magicline rate-bundle, mit Fallback für das Prerendering und für Ladefehler.
 * Black Month (bis 30.11.2026): Banner kommt global aus dem Layout und ersetzt so lange den START-39-Banner; dazu Hero-Knopf und Karte vor den Preisen.
 */
import { useState } from "react";
import { ArrowRight, ChevronDown, MapPin, Clock, Phone, Star, Check, CalendarDays, ScanLine, Users, GlassWater, ShowerHead, Dumbbell, Bike, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { WHATSAPP, PHONE, PHONE_HREF } from "@/lib/magicline";
import { useRateBundles, offerPrice, fmtPrice } from "@/lib/useRateBundles";
import { TARIFE, PARKING, START39_RULE_SHORT } from "@/lib/tarife";
import { ParkingLine, ParkingSection } from "@/components/Parking";
import { FaqJsonLd } from "@/lib/jsonld";
import { OPENING_HOURS } from "@/components/Footer";
import GymGallery from "@/components/GymGallery";
import PriceStamp from "@/components/PriceStamp";
import Countdown from "@/components/Countdown";
import PromoVideo from "@/components/PromoVideo";
import { trackCta } from "@/lib/events";
import { useBlackMonthActive } from "@/lib/blackmonth";
import { useBlackWeekActive, usePromo, blackWeekPrices, useDaysLeft, afterText, BLACK_FRIDAY_DATE } from "@/lib/blackweek";
import { berlinToday } from "@/lib/blackmonth";
import { GYM_ONLY_FEATURES } from "@/components/BlackWeekCard";

// ─── Daten ────────────────────────────────────────────────────────────────────

const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/place/Skill+Cologne/@50.9371,6.9497,17z/data=!4m8!3m7!1s0x47bf259a5f555b25:0xa5bcfa4e61b6fe6!8m2!3d50.9371!4d6.9497!9m1!1b1!16s%2Fg%2F11j2y0ggb8";
const BORIS_PHOTO = "/img/manus/coach-boris-v2.webp";

const reviews = [
  { name: "Javier R.", text: "Skill ist für mich die beste Trainingsstätte in Köln. Alles ist tadellos, sauber und mit modernsten Geräten." },
  { name: "Natascha T.", text: "Mein absolutes Lieblingsstudio. Alle Trainer machen einen tollen Job." },
  { name: "Jakob M.", text: "Absolut Premium. Kompetenz steht hier an erster Stelle!" },
];

const trialSteps = [
  { icon: CalendarDays, n: "01", title: "Termin wählen.", text: "Online in einer Minute. Bestätigung sofort per E-Mail." },
  { icon: ScanLine, n: "02", title: "3D Scan.", text: "Scaneca Körperscan mit Auswertung. Dein Startpunkt in Zahlen." },
  { icon: Users, n: "03", title: "Coach Session.", text: "60 Minuten mit deinem Coach im Gym. Geräte, Technik, dein Plan." },
];

/* Zweiter Coach: Name, Foto und Satz liefert Boris. Bis dahin wird nur Boris gezeigt. */
const coaches: { name: string; role: string; text: string; photo: string | null }[] = [
  { name: "Boris", role: "Founder und Coach", text: "Progression vor Perfektion. Mit effektivem und effizientem Programming bringe ich jeden Kunden zum Ziel.", photo: BORIS_PHOTO },
];

/* Scan-Vergleich: zwei anonymisierte Zahlenpaare Woche 1 → Woche 12. Zahlen liefert Boris, bis dahin bleibt die Sektion ausgeblendet. */
const SCAN_COMPARISON: { label: string; week1: string; week12: string }[] | null = null;
// Beispiel: [{ label: "Körperfett", week1: "24,1 %", week12: "19,8 %" }, { label: "Muskelmasse", week1: "31,2 kg", week12: "33,9 kg" }]

const whySkill = [
  { title: "Du trainierst mit Plan.", desc: "Jede Class ist strukturiert. Kein Raten, was heute dran ist. Du kommst, du trainierst, du gehst stärker raus." },
  { title: "Du wirst gecoacht.", desc: "Unsere Coaches korrigieren, motivieren und fordern dich. Dein Coach kennt dich beim Namen." },
  { title: "Du misst Fortschritt.", desc: "3D-Körperscan, Trainingsplan, messbare Ziele. Du siehst, was sich verändert. Das hält dich dran." },
];

/* Was bei jeder Membership dabei ist, als Icon-Leiste */
/* Handtuch über der Stange (hinten kürzere Lage, vorne Streifen), Strich wie Lucide */
const Towel = (p: { className?: string }) => <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h20" /><path d="M5 4v11h3" /><path d="M8 4v17h11V4" /><path d="M8 17h11" /></svg>;
const included = [
  { icon: GlassWater, label: "Mineralgetränke", short: "Getränke", text: "Wasser und Mineralgetränke inklusive" },
  { icon: Towel, label: "Trainingshandtuch", short: "Handtuch", text: "Liegt für dich bereit" },
  { icon: ShowerHead, label: "Duschen", short: "Duschen", text: "Moderne Duschen und Umkleiden" },
  { icon: Bike, label: "Technogym", short: "Technogym", text: "Cardio, Kraft, funktionell" },
  { icon: Dumbbell, label: "Freihantelbereich", short: "Freihanteln", text: "Racks, Plattformen, Bumper Plates" },
  { icon: ScanLine, label: "3D Körperscan", short: "3D Scan", text: "Dein Startpunkt in Zahlen" },
] as const;

const formatsLine = [["SKILL I", "format-skill-i"], ["SKILL II", "format-skill-ii"], ["HYROX", "hyrox"], ["RAW", "format-raw"], ["ATHX", "format-athx"]] as const;

const faqItems = [
  { q: "Was passiert beim Probetraining?", a: "Du wählst online einen Termin, kommst ins Gym und trainierst 60 Minuten mit einem Coach. Der 3D Körperscan ist inklusive, du siehst deinen Startpunkt in Zahlen. Kostenlos und unverbindlich." },
  { q: "Ist SKILL CGN für Anfänger geeignet?", a: "Ja. Du musst nicht fit sein, um anzufangen. Der Coach passt jede Class an dein Level an. Wichtig ist nur, dass du anfängst." },
  { q: "Welcher Tarif passt zu mir?", a: "START 39 ist der Einstieg für Neukunden, nur online: 39 € je 4 Wochen, 4 Classes im Monat, monatlich kündbar. Die SKILL Mitgliedschaft ist unser Standard mit Gym ohne Limit, 6 Classes je vier Wochen und Parken. SKILL Unlimited für alle Classes, Scan alle 8 Wochen und ein Coach Gespräch im Monat." },
  { q: "Kann ich monatlich kündigen?", a: "Ja. SKILL Mitgliedschaft und SKILL Unlimited gibt es monatlich kündbar oder mit 12 Monaten Laufzeit, dann günstiger. START 39 ist monatlich kündbar, 1 Monat Mindestlaufzeit. Keine Gebühr, keine versteckten Klauseln." },
  { q: PARKING.faqQ, a: PARKING.faqA },
  { q: "Hat SKILL Cologne geschlossen?", a: "Nein. Wir sind im Mai in die Herzogstraße 16 bis 20 umgezogen, zwei Minuten vom Neumarkt, und haben täglich geöffnet." },
  { q: "Wie erreiche ich euch?", a: `Telefon ${PHONE}, per WhatsApp oder E-Mail an info@skill-studios.com. Herzogstraße 16–20, 50667 Köln, Bahn Neumarkt oder Rudolfplatz.` },
];

const badge = "block font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-4";
const ctaBtn = "campaign-button inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm px-8 py-5 min-h-[60px] hover:bg-white";
const Stars = () => <span className="flex gap-0.5" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />)}</span>;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-l-4 cursor-pointer transition-all duration-200 ${open ? "border-primary bg-primary/5" : "border-foreground/20 hover:border-primary/60"}`} onClick={() => setOpen(v => !v)}>
      <div className="flex items-center justify-between px-6 py-5">
        <span className="font-black uppercase tracking-wide text-sm md:text-base pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-primary flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>
      {open && <div className="px-6 pb-5"><p className="text-foreground/70 text-sm leading-relaxed">{a}</p></div>}
    </div>
  );
}


// ─── Seite ────────────────────────────────────────────────────────────────────

export default function Home() {
  usePageMeta("SKILL CGN, Dein Coach. Dein Plan. Training mit System in der Kölner Innenstadt", "Betreutes Training mit Coach in jeder Class, 3D Körperscan und Plan. Boutique Gym mit Technogym, zwei Minuten vom Neumarkt, Parken inklusive. Probetraining kostenlos.");
  const { bundles } = useRateBundles();
  const blackMonth = useBlackMonthActive();
  const blackWeek = useBlackWeekActive();
  const promo = usePromo();
  const bw = blackWeekPrices(bundles);
  const bwHero = promo.key === "blackweek";
  /* Banner zählt wie der Timer: bis Black Friday, danach bis Angebotsende */
  const daysLeft = useDaysLeft(promo.key === "blackweek" && berlinToday() <= BLACK_FRIDAY_DATE ? BLACK_FRIDAY_DATE : promo.ends);
  const price = (key: "start39" | "mitgliedschaft" | "unlimited", months: 1 | 12) => fmtPrice(offerPrice(bundles, key, months) ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FaqJsonLd items={faqItems} />

      {/* ── 0. KAMPAGNEN-BANNER: immer nur ein Angebot (usePromo: bis 30.11. Black Week, sonst START 39) ── */}
      {!blackMonth && <Link to={promo.path} onClick={() => trackCta(`cta_${promo.key}_banner`)} className="campaign-button relative z-20 mt-20 flex items-center justify-center gap-3 bg-primary px-4 py-3 text-center text-primary-foreground hover:bg-white">
        <Zap className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] sm:text-xs"><span className="font-black">{promo.label}</span> {promo.banner}{daysLeft && <> · <span className="font-black">{daysLeft}</span></>}</span>
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>}

      {/* ── 1. HERO: ein Ziel ── */}
      <section className="relative overflow-hidden border-b-4 border-primary">
        <div className="campaign-grid absolute inset-0 opacity-70" />
        <div className="container relative z-10 py-10 md:py-16">
          <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/70 hover:text-primary"><Stars /> 4,9 Sterne bei 167 Google Bewertungen</a>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className={`max-w-3xl ${bwHero ? "flex flex-col" : ""}`}>
              {bwHero ? (
                <h1 className="campaign-display text-[60px] sm:text-7xl md:text-8xl lg:text-[112px] uppercase leading-[0.86]">Black Week.<br /><span className="text-primary">Gym Only.</span><br />{fmtPrice(bw.now)}&nbsp;€.<PriceStamp /><span className="mt-4 block font-mono text-[11px] normal-case leading-relaxed tracking-[0.16em] text-foreground/60 sm:text-xs">Fitnessstudio Köln · Herzogstraße, zwei Minuten vom Neumarkt</span></h1>
              ) : <h1 className="campaign-display text-[60px] sm:text-7xl md:text-8xl lg:text-[112px] uppercase leading-[0.86]">Dein Coach.<br /><span className="text-primary">Dein Plan.</span><br />Mitten in Köln.</h1>}
              <p className={`campaign-display mt-4 text-3xl md:text-5xl uppercase leading-none text-foreground/80 ${bwHero ? "hidden sm:block" : ""}`}>Show up. Earn it.</p>
              <p className={`mt-5 max-w-xl text-base md:text-lg text-foreground/70 leading-relaxed ${bwHero ? "order-last sm:order-none" : ""}`}>{bwHero ? "Trainier, wann es dir passt: morgens ab 7, unter der Woche bis 22 Uhr. Hanteln, Geräte, Sprintbahn, alles da. Dusche, Getränke und Handtuch inklusive. Zum Start zeigt dir der 3D Scan, wo du stehst. Passt es nicht, kündigst du zum nächsten Monat." : "Betreutes Training mit System: Coach in jeder Class, 3D Körperscan und ein Plan mit deinem Namen. Boutique Gym mit Technogym, zwei Minuten vom Neumarkt."}</p>
              <div className="mt-8 max-w-md">
                <Link data-promo-cta to={promo.formPath} onClick={() => trackCta(`cta_${promo.key}_hero`)} className={`${ctaBtn} w-full`}>{promo.cta} <ArrowRight className="w-4 h-4" /></Link>
                <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/50">{promo.line}</p>
                {bwHero && <Countdown variant="home" className="mt-5" />}
                {blackMonth && <Link to="/blackmonth" onClick={() => trackCta("cta_blackmonth_hero")} className="campaign-button mt-4 inline-flex w-full items-center justify-center gap-2 border-2 border-primary bg-black px-6 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">Black Month ansehen <ArrowRight className="w-4 h-4" /></Link>}
                {bwHero ? <p className="mt-4 text-center text-sm text-foreground/60">Erst ansehen? <Link to="/probetraining" onClick={() => trackCta("cta_probetraining_hero")} className="font-bold text-foreground underline underline-offset-4 hover:text-primary">Kostenloses Probetraining</Link></p>
                  : <Link to="/probetraining" onClick={() => trackCta("cta_probetraining_hero")} className="campaign-button mt-4 inline-flex w-full items-center justify-center gap-2 border-2 border-foreground/30 px-6 py-4 text-xs font-black uppercase tracking-widest text-foreground/80 hover:border-primary hover:text-primary">Kostenloses Probetraining</Link>}
              </div>
            </div>
            {/* Gesicht: Boris. Während Black Week das Gym selbst (Gym Only: ohne Coaching, also kein Coaching-Bild) */}
            <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
              {bwHero ? <>
              <PromoVideo src="/video/blackweek-boris.mp4" poster="/video/blackweek-boris-poster.webp" label="Boris, Founder von SKILL CGN, erklärt den Black Week Deal: Gym Only für 29 € alle 4 Wochen" className="mx-auto w-full max-w-[300px] sm:max-w-[340px] lg:mx-0 lg:max-w-[360px]" />
              </> : <>
              <img src={BORIS_PHOTO} alt="Boris, Founder SKILL CGN" width={840} height={1050} className="h-24 w-20 shrink-0 object-cover border-2 border-primary sm:h-32 sm:w-28 lg:h-auto lg:w-full lg:max-w-[360px] lg:aspect-[4/5]" loading="eager" />
              <div><p className="text-sm md:text-base font-bold leading-snug">„Progression vor Perfektion.“</p><p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-primary">Boris, Founder</p></div>
              </>}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. DREI BEWERTUNGEN ── */}
      <section className="py-14 bg-card border-b border-foreground/10">
        <div className="container grid md:grid-cols-3 gap-px bg-foreground/10">
          {reviews.map(r => (
            <a key={r.name} href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="bg-card p-6 flex flex-col gap-3 hover:bg-primary/5 transition-colors">
              <Stars /><p className="text-foreground/80 text-sm leading-relaxed flex-1">„{r.text}“</p><p className="font-mono text-[11px] uppercase tracking-widest text-primary">{r.name} · Google</p>
            </a>
          ))}
        </div>
      </section>

      {/* ── 2b. BLACK MONTH (bis 30.11.2026) ── */}
      {blackMonth && (
        <section className="py-14 bg-background border-b border-foreground/10" id="blackmonth">
          <div className="container">
            <div className="border-2 border-primary bg-black p-7 md:p-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
              <div>
                <div className={badge}>Black Month · nur im November</div>
                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">6 Monate Gym.<br /><span className="text-primary">149 € einmalig.</span></h2>
                <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                  {["6 Monate Gym", "Kein Abo", "Nur Neukunden", "Bis 30.11."].map(t => <li key={t} className="flex items-center gap-2 text-sm font-bold"><Check className="w-4 h-4 text-primary shrink-0" />{t}</li>)}
                </ul>
              </div>
              <Link to="/blackmonth" onClick={() => trackCta("cta_blackmonth_card")} className={`${ctaBtn} mt-8 w-full lg:mt-0 lg:w-auto`}>Black Month ansehen <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. PREISE ── */}
      <section className="py-20 bg-background border-b border-foreground/10" id="memberships">
        <div className="container">
          <div className="mb-10"><div className={badge}>Preise</div><h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">Drei Tarife.<br /><span className="text-primary">{bwHero ? <>Ab {fmtPrice(bw.now)}&nbsp;€.</> : "Ein Coach."}</span></h2><p className="mt-4 text-sm text-foreground/50">Keine Gebühr, in keinem Tarif. Abrechnung alle vier Wochen.</p></div>
          <div className="grid md:grid-cols-3 gap-px bg-foreground/10">
            {TARIFE.map(t => {
              const isStart = t.key === "start39"; const hi = !!t.recommended;
              /* Bis 30.11.: links Gym Only (Black Week) statt START 39, Streichpreis = reguläres Gym Only */
              if (isStart && blackWeek) return (
              <div key="blackweek" className="relative flex flex-col p-7 md:p-8 border-t-4 border-primary bg-card">
                <span className="absolute right-4 top-4 bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-primary-foreground">Black Week · bis 30.11.</span>
                <h3 className="text-2xl font-black uppercase tracking-tight pr-24">Gym Only</h3>
                <p className="mt-1 text-primary text-xs font-black uppercase tracking-widest">Ohne Classes</p>
                <div className="mt-5"><span className="text-5xl font-black font-mono">{fmtPrice(bw.now)}</span><span className="ml-2 text-sm text-foreground/60">€ alle vier Wochen</span><p className="mt-1 text-xs text-foreground/50">Monatlich kündbar, 1 Monat Laufzeit. Nur online, nur Neukunden. {afterText(fmtPrice(bw.was))}</p></div>
                <ul className="mt-5 space-y-2 flex-1">{GYM_ONLY_FEATURES.map(f => <li key={f} className="flex items-start gap-2 text-sm text-foreground/75"><Check className="mt-0.5 w-4 h-4 text-primary shrink-0" />{f}</li>)}</ul>
                <Link data-promo-cta to="/blackweek#formular" onClick={() => trackCta("cta_blackweek_preise")} className="campaign-button mt-6 inline-flex items-center justify-center gap-2 border-2 border-primary px-5 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">Gym Only {fmtPrice(bw.now)}&nbsp;€ sichern <ArrowRight className="w-4 h-4" /></Link>
              </div>
              );
              return (
              <div key={t.key} className={`relative flex flex-col p-7 md:p-8 ${hi ? "bg-primary/10 border-t-4 border-primary" : isStart ? "border-t-4 border-foreground/30 bg-card" : "bg-background"}`}>
                {(isStart || hi) && <span className="absolute right-4 top-4 bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-primary-foreground">{hi ? "Empfohlen" : "Nur Neukunden"}</span>}
                <h3 className="text-2xl font-black uppercase tracking-tight pr-24">{t.name}</h3>
                <p className="mt-1 text-primary text-xs font-black uppercase tracking-widest">{t.classes}</p>
                {isStart ? (
                  <div className="mt-5"><span className="text-5xl font-black font-mono">{price("start39", 1)}</span><span className="ml-2 text-sm text-foreground/60">€ alle vier Wochen</span><p className="mt-1 text-xs text-foreground/50">{START39_RULE_SHORT}. Nur online, nur Neukunden.</p></div>
                ) : (
                  <>
                    <div className="mt-5"><span className="text-5xl font-black font-mono">{price(t.key, 12)}</span><span className="ml-2 text-sm text-foreground/60">€ alle vier Wochen</span><p className="mt-1 text-xs text-foreground/40">bei 12 Monaten Laufzeit</p></div>
                    <p className="mt-3 text-sm text-foreground/70">Monatlich kündbar: <span className="font-mono font-bold text-foreground">{price(t.key, 1)} €</span> alle vier Wochen</p>
                  </>
                )}
                <ul className="mt-5 space-y-2 flex-1">{t.features.map(f => <li key={f} className="flex items-start gap-2 text-sm text-foreground/75"><Check className="mt-0.5 w-4 h-4 text-primary shrink-0" />{f}</li>)}</ul>
                <ParkingLine perWeek={t.parkingPerWeek} />
                {isStart ? (
                  <Link to="/start39" onClick={() => trackCta("cta_start39_preise")} className="campaign-button mt-6 inline-flex items-center justify-center gap-2 border-2 border-primary px-5 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">{t.cta} <ArrowRight className="w-3.5 h-3.5" /></Link>
                ) : (
                  <Link to={t.link} className={`mt-6 inline-flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs px-5 py-4 transition-colors ${hi ? "campaign-button bg-primary text-primary-foreground hover:bg-white" : "campaign-button border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`}>{t.cta} <ArrowRight className="w-3.5 h-3.5" /></Link>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3a. PARKEN INKLUSIVE ── (nicht während Black Week: Gym Only 29 hat kein Parken, der Block würde irritieren) */}
      {!bwHero && <ParkingSection />}

      {/* ── 3b. INKLUSIVE ── */}
      <section className="py-14 bg-card border-b border-foreground/10" id="inklusive">
        <div className="container">
          <div className="mb-8"><div className={badge}>Bei jeder Membership dabei</div><h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-none">Alles drin.<br /><span className="text-primary">Nichts extra.</span></h2></div>
          <ul className="grid grid-cols-3 gap-px bg-foreground/10 lg:grid-cols-6">
            {included.map(({ icon: Icon, label, short, text }) => (
              <li key={label} className="bg-card p-3 sm:p-5"><span className="flex h-9 w-9 items-center justify-center bg-primary/10 text-primary sm:h-10 sm:w-10"><Icon className="h-5 w-5" /></span><p className="mt-3 font-sans text-[11px] font-black uppercase leading-tight tracking-wide sm:mt-4 sm:text-sm"><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span></p><p className="mt-1 hidden text-xs leading-relaxed text-foreground/60 sm:block">{text}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 4. PROBETRAINING IN DREI SCHRITTEN ── */}
      <section className="py-20 bg-card border-b border-foreground/10" id="trial">
        <div className="container">
          <div className="mb-10"><div className={badge}>Kostenlos</div><h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">Probetraining<br /><span className="text-primary">in drei Schritten.</span></h2></div>
          <div className="grid md:grid-cols-3 gap-px bg-foreground/10">
            {trialSteps.map(({ icon: Icon, n, title, text }) => (
              <div key={n} className="bg-card p-7"><div className="flex items-center justify-between"><span className="font-mono text-xs text-foreground/40">{n}</span><Icon className="w-5 h-5 text-primary" /></div><h3 className="mt-8 text-2xl font-black uppercase tracking-tight">{title}</h3><p className="mt-2 text-sm text-foreground/65 leading-relaxed">{text}</p></div>
            ))}
          </div>
          <Link to="/probetraining" onClick={() => trackCta("cta_probetraining_steps")} className={bwHero ? "campaign-button mt-8 inline-flex w-full items-center justify-center gap-2 border-2 border-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground md:w-auto" : `${ctaBtn} mt-8 w-full md:w-auto`}>Kostenloses Probetraining mit 3D Scan <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      {/* ── 5. COACHES ── */}
      <section className="py-20 bg-background border-b border-foreground/10" id="coaches">
        <div className="container">
          <div className="mb-10"><div className={badge}>Dein Coach</div><h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">Menschen,<br /><span className="text-primary">nicht Geräte.</span></h2></div>
          <div className="grid sm:grid-cols-2 gap-px bg-foreground/10">
            {coaches.map(c => (
              <div key={c.name} className="bg-background p-6 flex gap-5 items-start">
                {c.photo ? <img src={c.photo} alt={`${c.name}, ${c.role}`} width={840} height={1050} className="h-32 w-24 shrink-0 object-cover border-2 border-primary" loading="lazy" /> : <div className="h-32 w-24 shrink-0 border-2 border-foreground/20 flex items-end p-2"><span className="font-mono text-[10px] uppercase text-foreground/40">Foto folgt</span></div>}
                <div><p className="text-xl font-black uppercase tracking-tight">{c.name}</p><p className="font-mono text-[11px] uppercase tracking-widest text-primary">{c.role}</p><p className="mt-3 text-sm text-foreground/75 leading-relaxed">„{c.text}“</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5b. KEIN NORMALES GYM ── */}
      <section className="py-20 bg-card border-b border-foreground/10">
        <div className="container grid md:grid-cols-[1fr_2fr] gap-10 items-start">
          <div><div className={badge}>Warum SKILL</div><h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">Kein<br />normales<br />Gym.</h2><p className="mt-4 text-sm text-foreground/60 leading-relaxed">Betreutes Training mit System, nicht Geräte bedienen.</p></div>
          <div>{whySkill.map((item, idx) => (
            <div key={item.title} className="flex gap-5 p-6 border-b border-foreground/10"><span className="text-3xl font-black text-primary/30 leading-none w-10 shrink-0">{String(idx + 1).padStart(2, "0")}</span><div><h3 className="font-sans font-black uppercase tracking-wide text-base">{item.title}</h3><p className="mt-1 text-sm text-foreground/65 leading-relaxed">{item.desc}</p></div></div>
          ))}</div>
        </div>
      </section>

      {/* ── 6. SCAN-VERGLEICH (ausgeblendet, bis Zahlen da sind) ── */}
      {SCAN_COMPARISON && (
        <section className="py-20 bg-background border-b border-foreground/10" id="scan">
          <div className="container">
            <div className="mb-10"><div className={badge}>Woche 1 → Woche 12</div><h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">Gemessen,<br /><span className="text-primary">nicht geschätzt.</span></h2></div>
            <div className="grid sm:grid-cols-2 gap-px bg-foreground/10">
              {SCAN_COMPARISON.map(s => <div key={s.label} className="bg-card p-7"><p className="font-mono text-[11px] uppercase tracking-widest text-primary">{s.label}</p><div className="mt-3 flex items-end gap-4"><div><p className="text-xs text-foreground/40">Woche 1</p><p className="text-3xl font-black font-mono">{s.week1}</p></div><ArrowRight className="mb-2 w-5 h-5 text-primary" /><div><p className="text-xs text-foreground/40">Woche 12</p><p className="text-3xl font-black font-mono text-primary">{s.week12}</p></div></div></div>)}
            </div>
            <p className="mt-4 text-xs text-foreground/40">Anonymisierte Scaneca-Werte eines Mitglieds. Ergebnisse sind individuell.</p>
          </div>
        </section>
      )}

      {/* ── 7. GALERIE, sechs Bilder ── */}
      <section className="py-20 bg-background border-b border-foreground/10 overflow-hidden" id="gym">
        <div className="container">
          <div className="mb-8 grid md:grid-cols-[1fr_2fr] gap-6 items-end"><div><div className={badge}>Herzogstraße 16–20</div><h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">Ein Blick<br />ins Gym.</h2></div><p className="text-sm text-foreground/60 leading-relaxed max-w-xl">Technogym, Freihantelbereich, Kunstrasenbahn mit HYROX Schlitten, 3D-Körperscan, Wasserbar und Duschen.</p></div>
          <GymGallery variant="home" limit={6} />
        </div>
      </section>

      {/* ── 8. FORMATE als Zeile ── */}
      <section className="py-10 bg-card border-b border-foreground/10">
        <div className="container flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/60">Fünf Formate, ein System</p>
          <div className="flex flex-wrap gap-2">{formatsLine.map(([name, anchor]) => <Link key={name} to={`/classes#${anchor}`} className="border border-foreground/20 px-4 py-2 text-xs font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-colors">{name}</Link>)}</div>
          <Link to="/classes" className="md:ml-auto inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:underline">Alle Classes <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      </section>

      {/* ── 9. STANDORT UND ÖFFNUNGSZEITEN ── */}
      <section className="py-20 bg-background border-b border-foreground/10" id="standort">
        <div className="container grid md:grid-cols-2 gap-10 items-start">
          <div>
            <div className={badge}>Öffnungszeiten</div>
            <div className="border border-foreground/10">{OPENING_HOURS.map(item => <div key={item.days} className="flex items-center justify-between px-5 py-4 border-b border-foreground/10 last:border-0"><span className="font-black uppercase tracking-wide text-sm text-foreground/70">{item.days}</span><span className="font-mono font-black text-primary tabular-nums">{item.hours}</span></div>)}</div>
          </div>
          <div>
            <div className={badge}>Standort</div>
            <div className="border border-foreground/10 p-6 space-y-5">
              <div className="flex items-start gap-4"><MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><p className="font-black uppercase tracking-wide text-sm">Herzogstraße 16–20, 50667 Köln</p><p className="text-sm text-foreground/65">Zwei Minuten vom Neumarkt. Bahn Neumarkt oder Rudolfplatz, Parkhaus am Ort.</p></div></div>
              <div className="flex items-start gap-4"><Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" /><p className="text-sm text-foreground/65">Täglich geöffnet, Classes morgens, mittags und abends.</p></div>
              <div className="flex items-start gap-4"><Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" /><p className="text-sm"><a href={PHONE_HREF} onClick={() => trackCta("cta_anrufen")} className="font-bold text-primary hover:underline">{PHONE}</a> · <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" onClick={() => trackCta("cta_whatsapp")} className="font-bold text-primary hover:underline">WhatsApp</a></p></div>
              <a href="https://maps.google.com/?q=Herzogstra%C3%9Fe+16-20,+50667+K%C3%B6ln" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-foreground/20 px-5 py-3 text-xs font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-colors">Route öffnen <ArrowRight className="w-3.5 h-3.5" /></a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. FAQ ── */}
      <section className="py-20 bg-card border-b border-foreground/10" id="faq">
        <div className="container grid md:grid-cols-[1fr_2fr] gap-10 items-start">
          <div className="md:sticky md:top-28"><div className={badge}>FAQ</div><h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">Häufige<br />Fragen.</h2><p className="mt-4 text-sm text-foreground/60">Noch Fragen? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" onClick={() => trackCta("cta_whatsapp")} className="font-bold text-primary hover:underline">WhatsApp</a> oder <a href={PHONE_HREF} onClick={() => trackCta("cta_anrufen")} className="font-bold text-primary hover:underline">anrufen</a>.</p></div>
          <div className="space-y-2">{faqItems.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}</div>
        </div>
      </section>

      {/* ── 11. SCHLUSS ── */}
      <section className="relative py-24 bg-primary overflow-hidden">
        <div className="container relative text-center">
          {bwHero ? <>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tight text-primary-foreground leading-none">Black Week.<br />Gym Only {fmtPrice(bw.now)}&nbsp;€.</h2>
          <p className="mt-5 text-primary-foreground/70 text-lg max-w-xl mx-auto leading-relaxed">Alle 4 Wochen, dauerhaft. Monatlich kündbar, 3D Scan zum Start. Abschluss bis 30.11.</p>
          <Link data-promo-cta to="/blackweek#formular" onClick={() => trackCta("cta_blackweek_footer")} className="campaign-button mt-8 inline-flex items-center justify-center gap-3 bg-black text-primary font-black uppercase tracking-widest text-sm px-10 py-5 min-h-[60px] hover:bg-white hover:text-black">{promo.cta} <ArrowRight className="w-4 h-4" /></Link>
          <p className="mt-5 text-sm text-primary-foreground/70">Lieber erst ansehen? <Link to="/probetraining" onClick={() => trackCta("cta_probetraining_footer")} className="font-bold text-primary-foreground underline underline-offset-4">Kostenloses Probetraining mit 3D Scan</Link></p>
          </> : <>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tight text-primary-foreground leading-none">Dein Coach.<br />Dein Plan.</h2>
          <p className="mt-5 text-primary-foreground/70 text-lg max-w-xl mx-auto leading-relaxed">60 Minuten mit Coach, 3D Scan inklusive. Kostenlos, ohne Bindung.</p>
          <Link to="/probetraining" onClick={() => trackCta("cta_probetraining_footer")} className="campaign-button mt-8 inline-flex items-center justify-center gap-3 bg-black text-primary font-black uppercase tracking-widest text-sm px-10 py-5 min-h-[60px] hover:bg-white hover:text-black">Kostenloses Probetraining mit 3D Scan <ArrowRight className="w-4 h-4" /></Link>
          </>}
        </div>
      </section>
    </div>
  );
}
