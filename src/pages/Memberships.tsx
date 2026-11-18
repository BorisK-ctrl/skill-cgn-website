/*
 * SKILL CGN — Memberships: drei Tarife (START 39, SKILL Mitgliedschaft, SKILL Unlimited), Laufzeit 12 Monate oder monatlich.
 * Preise live aus dem Magicline rate-bundle (src/lib/useRateBundles offerPrice), Fallback aus OFFERS. Leistungen aus src/lib/tarife.ts.
 * Parken: Zeile in jeder Karte, Block "So funktioniert Parken" (src/components/Parking.tsx).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ArrowLeft, Check, Minus, Zap, Star, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { useRateBundles, offerPrice, fmtPrice } from "@/lib/useRateBundles";
import { TARIFE, PARKING, START39_OFFER, START39_RULE, parkingLabel, type Tarif } from "@/lib/tarife";
import BlackWeekCard from "@/components/BlackWeekCard";
import { useBlackWeekActive, blackWeekPrices } from "@/lib/blackweek";
import { ParkingLine, ParkingSteps } from "@/components/Parking";

type Tier = "12months" | "monthly";
const tierLabels: Record<Tier, string> = { "12months": "12 Monate", monthly: "Monatlich kündbar" };
const icons = [Zap, Star, Crown];

const faqItems = [
  { q: "Welcher Tarif passt zu mir?", a: "START 39 ist der Einstieg für Neukunden, nur online. Die SKILL Mitgliedschaft ist unser Standard: Gym ohne Limit, 6 Classes je vier Wochen, Scan alle 12 Wochen, Parken. SKILL Unlimited für alle Classes, Scan alle 8 Wochen und ein Coach Gespräch im Monat." },
  { q: PARKING.faqQ, a: PARKING.faqA },
  { q: "Kann ich mein Membership jederzeit kündigen?", a: "Monatlich kündbare Tarife jederzeit mit einer Frist von einem Monat. Bei 12 Monaten gilt die Laufzeit, danach monatlich kündbar. START 39 ist monatlich kündbar, 1 Monat Mindestlaufzeit." },
  { q: "Wie lange läuft START 39?", a: `${START39_OFFER} ${START39_RULE}` },
  { q: "Gibt es eine Aufnahme- oder Aktivierungsgebühr?", a: "Nein. In keinem Tarif. Du zahlst nur den Beitrag alle vier Wochen." },
  { q: "Kann ich zwischen Tarifen wechseln?", a: "Ja. Ein Upgrade ist jederzeit möglich und wird sofort wirksam. Ein Downgrade gilt ab dem nächsten Abrechnungszyklus." },
  { q: "Was ist ein 3D-Körperscan?", a: "Unser Scaneca 3D-Scanner misst Körperzusammensetzung, Muskelmasse und Körperfettanteil präzise. Du siehst deinen Fortschritt in Zahlen." },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-l-4 transition-all duration-200 cursor-pointer ${open ? "border-primary bg-primary/5" : "border-foreground/20 hover:border-primary/60"}`} onClick={() => setOpen(v => !v)}>
      <div className="flex items-center justify-between px-6 py-5"><h4 className="font-black uppercase tracking-wide text-sm md:text-base pr-4 font-sans">{q}</h4><span className={`text-primary font-black text-xl flex-shrink-0 transition-transform ${open ? "rotate-45" : ""}`}>+</span></div>
      {open && <div className="px-6 pb-5"><p className="text-foreground/70 text-sm leading-relaxed">{a}</p></div>}
    </div>
  );
}

function PriceBlock({ t, tier, price, big }: { t: Tarif; tier: Tier; price: number | null; big: boolean }) {
  const isStart = t.key === "start39";
  return (
    <div className={big ? "mb-6 pb-6 border-b border-foreground/10" : "mb-5 pb-5 border-b border-foreground/10"}>
      <div className="flex items-end gap-2 mb-1">
        <span className={`${big ? "text-6xl" : "text-5xl"} font-black leading-none tracking-tight font-mono ${t.recommended ? "text-primary" : "text-foreground"}`}>{price == null ? "–" : fmtPrice(price)}</span>
        <div className={big ? "mb-2" : "mb-1"}><span className={`${big ? "text-lg" : "text-base"} font-black text-foreground/60`}>€</span><span className={`block ${big ? "text-xs" : "text-[10px]"} text-foreground/40 font-bold uppercase`}>alle vier Wochen</span></div>
      </div>
      <p className={`${big ? "text-xs" : "text-[10px]"} text-foreground/50 leading-relaxed`}>{isStart ? "Monatlich kündbar, 1 Monat Mindestlaufzeit. Nur online, nur Neukunden." : tier === "monthly" ? "Monatlich kündbar, keine Gebühr" : "Bei 12 Monaten Laufzeit, keine Gebühr"}</p>
    </div>
  );
}

function Card({ t, tier, price, idx, big }: { t: Tarif; tier: Tier; price: number | null; idx: number; big: boolean }) {
  const Icon = icons[idx]; const hi = !!t.recommended;
  return (
    <div className={`relative flex flex-col h-full ${big ? "p-8" : "p-6"} border-2 ${hi ? "border-primary bg-card" : "border-foreground/15 bg-card"}`}>
      {hi && <div className="absolute -top-px left-0 right-0 h-1 bg-primary" />}
      {hi && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-5 py-1 font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">★ Empfohlen</div>}
      {t.newOnly && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-foreground text-background px-5 py-1 font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Nur Neukunden</div>}
      <div className="mb-5"><div className={`inline-flex items-center justify-center w-10 h-10 mb-3 ${hi ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground/60"}`}><Icon className="w-5 h-5" /></div><h3 className="text-2xl font-black uppercase tracking-tight">{t.name}</h3><p className="text-xs text-foreground/50 mt-0.5">{t.tagline}</p></div>
      <PriceBlock t={t} tier={tier} price={price} big={big} />
      <div className="space-y-3 flex-1">{[t.gym, t.classes, t.scan, t.plan, ...(t.coachTalk ? [t.coachTalk] : [])].map(f => <div key={f} className="flex items-start gap-3"><span className="w-5 h-5 bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="w-3 h-3 text-primary" /></span><span className="text-sm text-foreground/80">{f}</span></div>)}</div>
      <ParkingLine perWeek={t.parkingPerWeek} />
      <Link to={t.link} className={`mt-6 inline-flex items-center justify-center w-full font-black uppercase tracking-widest ${big ? "text-sm py-5" : "text-xs py-4"} campaign-button ${hi ? "bg-primary text-primary-foreground hover:bg-white" : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`}>{t.cta} <ArrowRight className="w-4 h-4 ml-2" /></Link>
    </div>
  );
}

/** START 39 während Black Week durch die Gym-Only-Karte ersetzt (nur eine beworbene Aktion), sonst die normale Karte. */
function PlanCard(props: { t: Tarif; tier: Tier; price: number | null; idx: number; big: boolean }) {
  const active = useBlackWeekActive(); const { bundles } = useRateBundles(); const p = blackWeekPrices(bundles);
  if (active && props.t.key === "start39") return <BlackWeekCard now={p.now} was={p.was} big={props.big} />;
  return <Card {...props} />;
}

function Carousel({ tier, priceOf }: { tier: Tier; priceOf: (t: Tarif) => number | null }) {
  const [activeIdx, setActiveIdx] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  useEffect(() => { const el = scrollRef.current; if (!el) return; const w = el.scrollWidth / TARIFE.length; el.scrollLeft = w - (el.clientWidth - w) / 2; }, []);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current; if (!el || isScrolling.current) return;
    const w = el.scrollWidth / TARIFE.length; const c = el.scrollLeft + el.clientWidth / 2;
    const idx = Math.max(0, Math.min(TARIFE.length - 1, Math.round((c - w / 2) / w)));
    if (idx !== activeIdx) setActiveIdx(idx);
  }, [activeIdx]);
  const scrollTo = (idx: number) => { const el = scrollRef.current; if (!el) return; isScrolling.current = true; const w = el.scrollWidth / TARIFE.length; el.scrollTo({ left: w * idx - (el.clientWidth - w) / 2, behavior: "smooth" }); setActiveIdx(idx); setTimeout(() => { isScrolling.current = false; }, 400); };
  const arrow = "absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-background/80 border border-foreground/20 flex items-center justify-center text-foreground/70 hover:text-primary hover:border-primary transition-all";
  return (
    <div className="md:hidden">
      <div className="relative">
        {activeIdx > 0 && <button onClick={() => scrollTo(activeIdx - 1)} className={`${arrow} left-1`} aria-label="Vorheriger Tarif"><ChevronLeft className="w-4 h-4" /></button>}
        {activeIdx < TARIFE.length - 1 && <button onClick={() => scrollTo(activeIdx + 1)} className={`${arrow} right-1`} aria-label="Nächster Tarif"><ChevronRight className="w-4 h-4" /></button>}
        <div ref={scrollRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 px-4 py-5">
          {TARIFE.map((t, idx) => <div key={t.key} className={`snap-center flex-shrink-0 w-[84vw] max-w-[360px] transition-all duration-300 ${idx === activeIdx ? "opacity-100" : "opacity-60"}`}><PlanCard t={t} tier={tier} price={priceOf(t)} idx={idx} big={false} /></div>)}
        </div>
      </div>
      <div className="flex justify-center gap-2 mt-2">{TARIFE.map((_, idx) => <button key={idx} onClick={() => scrollTo(idx)} className={`h-2 transition-all duration-300 ${idx === activeIdx ? "bg-primary w-6" : "bg-foreground/20 w-2"}`} aria-label={`Tarif ${idx + 1}`} />)}</div>
    </div>
  );
}

export default function Memberships() {
  usePageMeta("Fitnessstudio Mitgliedschaft in Köln — SKILL CGN", "Mitgliedschaft im Fitnessstudio Köln Neumarkt: START 39, SKILL Mitgliedschaft, SKILL Unlimited. 12 Monate oder monatlich kündbar, keine Gebühr, Parken inklusive. Online abschließen.");
  const [tier, setTier] = useState<Tier>("12months");
  const { bundles, error } = useRateBundles();
  const priceOf = (t: Tarif) => t.key === "start39" ? offerPrice(bundles, "start39", 1) : offerPrice(bundles, t.key, tier === "12months" ? 12 : 1);
  const yearSaving = (t: Tarif) => { if (t.key === "start39") return null; const m = offerPrice(bundles, t.key, 1), y = offerPrice(bundles, t.key, 12); return m != null && y != null && y < m ? (m - y) * 13 : null; };
  const maxSaving = Math.max(0, ...TARIFE.map(t => yearSaving(t) ?? 0));

  const rows: [string, (t: Tarif) => string | boolean][] = [
    ["Gym", t => t.gym], ["Classes", t => t.classes], ["3D Körperscan", t => t.scan], ["Trainingsplan", t => t.plan],
    ["Coach Gespräch", t => t.coachTalk ?? false], ["Parken", t => t.parkingPerWeek ? parkingLabel(t.parkingPerWeek) : false],
    ["Laufzeit", t => t.terms], ["Gebühr", () => "Keine"], ["Abschluss", t => t.newOnly ? "Nur online, nur Neukunden" : "Online oder im Studio"],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-20 md:py-28 border-b-4 border-primary">
        <div className="campaign-grid absolute inset-0 opacity-70" />
        <div className="container relative">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-10 font-black uppercase text-xs tracking-widest"><ArrowLeft className="w-4 h-4" /> Zurück</Link>
          <div className="max-w-3xl">
            <p className="block font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-4">Mitgliedschaften</p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-none mb-6">Drei Tarife.<br /><span className="text-primary">Ein Coach.</span><span className="mt-4 block font-mono text-xs font-bold tracking-[0.22em] text-foreground/50 md:text-sm">Mitgliedschaft im Fitnessstudio Köln</span></h1>
            <p className="text-lg md:text-xl text-foreground/60 max-w-xl leading-relaxed">Keine Gebühr, in keinem Tarif. Parken inklusive ab der SKILL Mitgliedschaft. Abschluss online, der Vertrag entsteht direkt in unserem Mitgliedersystem.</p>
          </div>
        </div>
      </section>

      {/* ── LAUFZEIT ── */}
      <section className="py-10 bg-card border-b border-foreground/10">
        <div className="container">
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs font-black uppercase tracking-widest text-foreground/50">Laufzeit wählen</p>
            <div className="flex bg-background border-2 border-foreground/20 p-1 gap-1" role="radiogroup" aria-label="Laufzeit">
              {(["12months", "monthly"] as Tier[]).map(k => (
                <button key={k} role="radio" aria-checked={tier === k} onClick={() => setTier(k)} className={`relative px-5 py-2.5 text-sm font-black uppercase tracking-wider transition-all duration-200 ${tier === k ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:text-foreground"}`}>
                  {tierLabels[k]}
                  {k === "12months" && <span className="absolute -top-2.5 -right-2 bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wide">Günstiger</span>}
                </button>
              ))}
            </div>
            {tier === "12months" && maxSaving > 0 && <p className="text-xs text-primary font-bold">Bis zu {fmtPrice(maxSaving)} € im Jahr gespart gegenüber monatlich kündbar</p>}
          </div>
        </div>
      </section>

      {/* ── KARTEN ── */}
      <section id="plans" className="py-16 md:py-20 bg-background scroll-mt-24">
        <div className="container">
          {error && <p className="text-center text-sm text-primary font-bold mb-8">Die Live-Preise konnten nicht geladen werden, angezeigt werden die Listenpreise.</p>}
          <Carousel tier={tier} priceOf={priceOf} />
          <div className="hidden md:grid md:grid-cols-3 gap-6 items-stretch pt-4">
            {TARIFE.map((t, idx) => <div key={t.key} id={`plan-${t.key}`} className={`relative scroll-mt-24 ${t.recommended ? "md:-translate-y-3" : ""}`}><PlanCard t={t} tier={tier} price={priceOf(t)} idx={idx} big /></div>)}
          </div>
          <p className="text-center text-xs text-foreground/40 mt-8">Alle Preise inkl. MwSt. · Keine Gebühr · Abrechnung alle vier Wochen · 14 Tage Widerruf beim Onlineabschluss</p>
        </div>
      </section>

      {/* ── VERGLEICH ── */}
      <section className="py-20 bg-card border-t border-foreground/10">
        <div className="container">
          <div className="mb-10"><p className="block font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-3">Vergleich</p><h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Was ist drin?</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead><tr>
                <th className="text-left py-4 pr-6 font-black uppercase text-foreground/40 text-xs tracking-widest w-1/4 border-b-2 border-foreground/10">Leistungen</th>
                {TARIFE.map(t => <th key={t.key} className={`text-center py-4 px-4 font-black uppercase text-sm tracking-wide border-b-2 ${t.recommended ? "text-primary border-primary" : "text-foreground/60 border-foreground/10"}`}>{t.name}</th>)}
              </tr></thead>
              <tbody>
                <tr className="bg-foreground/[0.02]"><td className="py-3 pr-6 font-bold text-foreground/50 text-xs uppercase tracking-widest" colSpan={4}>Preise alle vier Wochen</td></tr>
                {([["12 Monate", 12], ["Monatlich kündbar", 1]] as [string, 1 | 12][]).map(([label, m], ridx) => (
                  <tr key={label} className={`border-b border-foreground/[0.06] ${ridx % 2 ? "bg-foreground/[0.02]" : ""}`}>
                    <td className="py-3.5 pr-6 text-foreground/70 font-medium">{label}</td>
                    {TARIFE.map(t => { const p = t.key === "start39" ? (m === 1 ? offerPrice(bundles, "start39", 1) : null) : offerPrice(bundles, t.key, m); return <td key={t.key} className={`text-center py-3.5 px-4 font-black font-mono ${t.recommended ? "text-primary" : "text-foreground"}`}>{p == null ? (t.key === "start39" ? "Nur monatlich" : "–") : `${fmtPrice(p)} €`}</td>; })}
                  </tr>
                ))}
                <tr className="bg-foreground/[0.02]"><td className="py-3 pr-6 font-bold text-foreground/50 text-xs uppercase tracking-widest pt-6" colSpan={4}>Leistungen</td></tr>
                {rows.map(([label, fn], ridx) => (
                  <tr key={label} className={`border-b border-foreground/[0.06] ${ridx % 2 ? "bg-foreground/[0.02]" : ""}`}>
                    <td className="py-3.5 pr-6 text-foreground/70 font-medium">{label}</td>
                    {TARIFE.map(t => { const v = fn(t); return <td key={t.key} className={`text-center py-3.5 px-4 ${t.recommended ? "bg-primary/5" : ""}`}>{v === false ? <Minus className="w-4 h-4 text-foreground/25 mx-auto" /> : v === true ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-xs font-bold text-primary leading-tight">{v}</span>}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── PARKEN ── */}
      <ParkingSteps />

      {/* ── FAQ ── */}
      <section className="py-20 bg-card border-t border-foreground/10">
        <div className="container">
          <div className="grid md:grid-cols-[1fr_2fr] gap-16 items-start">
            <div className="md:sticky md:top-28">
              <p className="block font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-3">FAQ</p>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mb-4">Häufige<br />Fragen</h2>
              <p className="text-foreground/50 text-sm leading-relaxed">Noch offene Fragen? Schreib uns an <a href="mailto:info@skill-studios.com" className="text-primary font-bold hover:underline">info@skill-studios.com</a></p>
            </div>
            <div className="space-y-2">{faqItems.map(item => <AccordionItem key={item.q} q={item.q} a={item.a} />)}</div>
          </div>
        </div>
      </section>

      {/* ── SCHLUSS ── */}
      <section className="py-24 bg-primary relative overflow-hidden">
        <div className="container relative text-center">
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-primary-foreground mb-4 leading-none">Unsicher,<br />welcher Tarif?</h2>
          <p className="text-primary-foreground/70 mb-10 max-w-xl mx-auto text-lg">Komm zum kostenlosen Probetraining mit 3D Scan, danach weißt du es.</p>
          <Link to="/probetraining" className="campaign-button inline-flex items-center bg-primary-foreground text-primary font-black px-12 py-6 uppercase tracking-widest text-base hover:bg-white hover:text-black">Probetraining buchen <ArrowRight className="w-5 h-5 ml-3" /></Link>
        </div>
      </section>
    </div>
  );
}
