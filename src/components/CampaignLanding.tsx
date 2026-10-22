/*
 * Gemeinsame Struktur der Abschlussseiten /start39 und /back39.
 * Mobil: Logo + Vertrauen, Headline, Preiszeile, drei Punkte, Knopf → Formular direkt darunter → Bewertungen → Video → Rest.
 * Desktop: links Text und Formular, rechts das Video (sticky). Feste Leiste unten, solange das Formular nicht im Bild ist.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, Check, MapPin, ScanLine, ClipboardList, Users } from "lucide-react";
import { openCookieSettings } from "@/lib/pixel";
import GymGallery from "@/components/GymGallery";

const LOGO_WHITE = "/img/manus/skill-cgn-original-white_18b77f12.svg";
const V1_VIDEO = "/img/manus/v1-layered-offer-stack-9x16_v2.mp4";   // v2: Zeile "12 weeks, then 49 €" durch "Monatlich kündbar" ersetzt (2026-10-22)
const V1_POSTER = "/img/manus/v1-poster-9x16-clean.webp";   // ohne alte Preiszeile ("12 weeks, then 49 €")
const COACH_PHOTO = "/img/manus/coach-boris-v2.webp";
const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/place/Skill+Cologne/@50.9371,6.9497,17z/data=!4m8!3m7!1s0x47bf259a5f555b25:0xa5bcfa4e61b6fe6!8m2!3d50.9371!4d6.9497!9m1!1b1!16s%2Fg%2F11j2y0ggb8";
/* Aus reference-site/index.html, Vornamen aus den Google-Bewertungen der alten Seite */
const REVIEWS = [
  { quote: "Skill ist für mich die beste Trainingsstätte in Köln.", name: "Javier" },
  { quote: "Kompetenz steht hier an erster Stelle.", name: "Jakob M." },
] as const;

export const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";
export const h2 = "campaign-display mt-4 text-5xl uppercase leading-[0.88] md:text-7xl";
const Stars = () => <span className="text-[#FBFF00]" aria-hidden="true">★★★★★</span>;

/** Video erst laden, wenn es fast im Bild ist. Quelle als src-Attribut plus load(), sonst zeigt Safari weder Poster noch Bild. */
function LazyVideo({ label }: { label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSrc(V1_VIDEO); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => { const v = ref.current; if (!src || !v) return; v.load(); v.play().catch(() => {}); }, [src]);
  return (
    <div className="mx-auto w-full max-w-[420px] bg-[#2A3133] p-3">
      <video ref={ref} src={src} className="aspect-[9/16] w-full object-cover" muted loop playsInline preload="none" poster={V1_POSTER} aria-label={label} width={720} height={1280} />
    </div>
  );
}

export interface LandingProps {
  campaign: string;
  badge?: string;
  headline: string;            // "START FOR 39€."
  h1Sub?: string;              // Suchphrase als kleine Zeile in der H1, z. B. "Fitnessstudio in Köln · 39 € je 4 Wochen"
  subline: string;             // "Dein Coach. Dein Plan."
  priceLine: string;           // "39 € je 4 Wochen · monatlich kündbar · keine Gebühr"
  priceNote?: ReactNode;       // Regel unter der Preiszeile, z. B. Wechsel in die SKILL Mitgliedschaft
  bullets: readonly string[];
  included?: readonly { label: string; sub?: string; wide?: boolean }[];   // "Alles drin"-Kacheln im ersten Bildschirm, ersetzen die Punkte
  feeNote?: { label: string; now: string; was?: string };   // z. B. Aufnahmegebühr 0 €, optional mit Vergleichspreis
  cta: string;                 // Knopftext
  forYou: readonly string[];
  coachQuote: string;
  faqs: readonly (readonly [string, string])[];
  beforeForm?: ReactNode;      // z. B. Laufzeitwahl bei BACK 39
  form: ReactNode;             // Checkout oder Platzhalter
}

export default function CampaignLanding(p: LandingProps) {
  const formRef = useRef<HTMLElement>(null);
  const [formVisible, setFormVisible] = useState(true);
  useEffect(() => {
    const el = formRef.current; if (!el) return;
    const io = new IntersectionObserver(es => setFormVisible(es.some(e => e.isIntersecting)), { threshold: 0.05 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const toForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const frame = [
    { icon: ScanLine, n: "01", t: "SCAN ZUM START.", c: "Scaneca 3D-Körperscan mit Auswertung. Dein Nullpunkt, gemessen, nicht geschätzt." },
    { icon: Users, n: "02", t: "PLAN DAZWISCHEN.", c: "Vier gecoachte Classes je vier Wochen, Gym, ein Plan mit deinem Namen drauf." },
    { icon: ClipboardList, n: "03", t: "SCAN ZUR KONTROLLE.", c: "Zweiter Scan nach ein paar Wochen, Vergleich mit dem Start, neuer Plan. Du bleibst, solange es dir etwas bringt. Monatlich kündbar." },
  ] as const;

  return (
    <main className="campaign-page bg-black text-white">
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center justify-between gap-4">
            <img src={LOGO_WHITE} alt="SKILL CGN" className="h-5 w-auto md:h-7" width={160} height={28} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/img/logo-white.svg"; }} />
            {p.badge && <span className="campaign-mono max-w-[44%] shrink-0 border border-[#FBFF00] px-1.5 py-1.5 text-right text-[8px] uppercase leading-snug tracking-[0.14em] text-[#FBFF00] md:hidden">{p.badge}</span>}
          </div>
          <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="campaign-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/70 hover:text-[#FBFF00]"><Stars /> 4,9 Sterne bei 167 Google Bewertungen</a>
          {p.badge && <span className="campaign-mono hidden shrink-0 border border-[#FBFF00] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-[#FBFF00] md:inline-block">{p.badge}</span>}
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 md:px-10 lg:grid lg:grid-cols-[1.05fr_0.75fr] lg:gap-16 lg:pt-14">
        <div className="min-w-0">
          {/* 1. Erster Bildschirm */}
          <section className="campaign-grid -mx-5 px-5 md:mx-0 md:px-0">
            <h1 className="campaign-display text-[68px] uppercase leading-[0.82] sm:text-[96px] md:text-[128px] lg:text-[144px]">{p.headline.replace(/39€\.$/, "")}<span className="text-[#FBFF00]">39€.</span>{p.h1Sub && <span className="campaign-mono mt-3 block text-[11px] tracking-[0.22em] text-white/60 sm:text-xs">{p.h1Sub}</span>}</h1>
            <p className="campaign-display mt-3 text-3xl uppercase leading-none text-white/85 sm:text-4xl md:text-5xl">{p.subline}</p>
            <p className="campaign-mono mt-5 text-[11px] uppercase leading-relaxed tracking-[0.14em] text-[#FBFF00] sm:text-xs">{p.priceLine}</p>
            {p.priceNote && <p className="mt-3 max-w-xl border-l-4 border-[#FBFF00] bg-[#2A3133] px-4 py-3 text-xs leading-relaxed text-white/75 md:text-sm">{p.priceNote}</p>}
            {p.included ? (
              <div className="mt-5">
                <p className="campaign-mono text-[10px] uppercase tracking-[0.22em] text-white/50">Alles drin</p>
                <ul className="mt-2 grid grid-cols-2 gap-px bg-white/15 md:grid-cols-4">
                  {p.included.map(i => <li key={i.label} className={`flex items-start gap-2 bg-[#111516] px-3 py-3 ${i.wide ? "col-span-2" : ""}`}><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-2.5 w-2.5 text-black" /></span><span className="min-w-0"><span className="block text-sm font-bold leading-tight text-white">{i.label}</span>{i.sub && <span className="block text-[11px] leading-snug text-white/55">{i.sub}</span>}</span></li>)}
                </ul>
                {p.feeNote && (
                  <div className="mt-px flex items-center justify-between gap-3 bg-[#FBFF00] px-4 py-3 text-black">
                    <span className="campaign-mono text-[11px] font-bold uppercase tracking-[0.18em]">{p.feeNote.label}</span>
                    <span className="flex items-baseline gap-2"><span className="campaign-display text-3xl leading-none">{p.feeNote.now}</span>{p.feeNote.was && <span className="campaign-mono text-xs font-bold uppercase tracking-[0.12em] text-black/60">statt <s>{p.feeNote.was}</s></span>}</span>
                  </div>
                )}
              </div>
            ) : (
              <ul className="mt-5 space-y-2">
                {p.bullets.map(b => <li key={b} className="flex items-center gap-3 text-sm font-bold text-white/90 md:text-base"><span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-3 w-3 text-black" /></span>{b}</li>)}
              </ul>
            )}
            <button type="button" onClick={toForm} className="campaign-button mt-6 flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white lg:max-w-md">{p.cta} <ArrowDown className="h-4 w-4" /></button>
          </section>

          {/* 2. Formular direkt darunter */}
          <section ref={formRef} id="formular" className="mt-8 scroll-mt-4 lg:max-w-2xl">
            {p.beforeForm}
            {p.form}
          </section>

          {/* 4. Bewertungen zwischen Formular und Video */}
          <section className="mt-6 grid gap-px bg-white/15 sm:grid-cols-2 lg:max-w-2xl">
            {REVIEWS.map(r => <div key={r.name} className="bg-[#2A3133] px-4 py-4"><p className="text-sm font-bold leading-snug text-white">„{r.quote}“</p><p className="campaign-mono mt-2 text-[9px] uppercase tracking-[0.2em] text-white/60"><Stars /> {r.name} · Google</p></div>)}
          </section>
        </div>

        {/* Desktop: Video rechts */}
        <aside className="hidden lg:block"><div className="sticky top-8"><LazyVideo label={`${p.campaign} Kampagnenvideo mit echten SKILL Models`} /><p className="campaign-display mt-5 text-5xl uppercase leading-none text-white/85">Show up.<br /><span className="text-[#FBFF00]">Earn it.</span></p></div></aside>
      </div>

      {/* 5. Danach: Video (mobil), Für dich wenn, Ablauf, Coach, Urban Sports, FAQ, Knopf */}
      <section className="border-t border-white/10 bg-[#2A3133] py-14 lg:hidden">
        <div className="mx-auto max-w-[1480px] px-5"><p className={kicker}>Real people. Real coaching.</p><h2 className={h2}>SHOW UP.<br /><span className="text-[#FBFF00]">EARN IT.</span></h2><div className="mt-8"><LazyVideo label={`${p.campaign} Kampagnenvideo mit echten SKILL Models`} /></div></div>
      </section>

      {/* Ein Blick ins Gym: echte Bilder als Vertrauen, direkt nach dem Video */}
      <section className="overflow-hidden border-t border-white/10 bg-black py-14 md:py-20">
        <div className="mx-auto max-w-[1480px] px-5 md:px-10">
          <p className={kicker}>Herzogstraße 16–20, Köln</p><h2 className={h2}>EIN BLICK<br /><span className="text-[#FBFF00]">INS GYM.</span></h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">Technogym, Freihantelbereich, Kunstrasenbahn mit HYROX Schlitten, Scaneca 3D-Scan, Wasserbar, Duschen. Das ist dein Trainingsort ab Tag eins.</p>
          <div className="mt-8"><GymGallery variant="campaign" /></div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black py-14 md:py-20">
        <div className="mx-auto max-w-[1480px] px-5 md:px-10">
          <p className={kicker}>Für wen</p><h2 className={h2}>FÜR DICH, WENN.</h2>
          <ul className="mt-8 grid gap-px bg-white/15 md:grid-cols-3">{p.forYou.map((line, i) => <li key={line} className="bg-[#2A3133] p-6"><span className="campaign-mono text-[10px] text-white/35">0{i + 1}</span><p className="mt-3 text-base font-bold leading-snug text-white">{line}</p></li>)}</ul>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#2A3133] py-14 md:py-20">
        <div className="mx-auto max-w-[1480px] px-5 md:px-10">
          <p className={kicker}>Dein Rahmen</p><h2 className={h2}>DEIN START.<br /><span className="text-[#FBFF00]">GEMESSEN.</span></h2>
          <div className="mt-8 grid gap-px bg-white/15 md:grid-cols-3">{frame.map(({ icon: Icon, n, t, c }) => <article key={n} className="bg-black p-6"><div className="flex items-center justify-between"><span className="campaign-mono text-[10px] text-white/35">{n}</span><Icon className="h-5 w-5 text-[#FBFF00]" /></div><h3 className="campaign-display mt-8 text-4xl leading-none text-white">{t}</h3><p className="mt-3 text-sm leading-relaxed text-white/60">{c}</p></article>)}</div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black py-14 md:py-20">
        <div className="mx-auto grid max-w-[1480px] gap-8 px-5 md:px-10 lg:grid-cols-[0.5fr_1.5fr] lg:items-center">
          <div className="mx-auto w-full max-w-[360px] bg-[#2A3133] p-3"><img src={COACH_PHOTO} alt="Boris, Founder SKILL CGN" className="aspect-[4/5] w-full object-cover" loading="lazy" width={840} height={1050} /></div>
          <div><p className={kicker}>Dein Coach</p><blockquote className="campaign-display mt-4 text-3xl uppercase leading-[0.92] text-white sm:text-4xl md:text-5xl">„{p.coachQuote}“</blockquote><p className="campaign-mono mt-5 text-[10px] uppercase tracking-[0.2em] text-[#FBFF00]">Boris, Founder SKILL CGN.</p></div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#2A3133] py-14 md:py-20">
        <div className="mx-auto grid max-w-[1480px] gap-6 px-5 md:px-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div><p className={kicker}>Urban Sports Club</p><h2 className={h2}>DU HAST<br /><span className="text-[#FBFF00]">URBAN SPORTS.</span></h2></div>
          <p className="max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">Dann kennst du unsere Classes schon. {p.campaign} gibt dir, was Urban Sports nicht hat: Gym und Geräte, 3D Scan, Plan.</p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black py-14 md:py-20">
        <div className="mx-auto max-w-[1100px] px-5 md:px-10">
          <p className={kicker}>Before you start</p><h2 className={h2}>CLEAR ANSWERS.</h2>
          <div className="mt-8 grid gap-px bg-white/15 md:grid-cols-2">{p.faqs.map(([q, a]) => <article key={q} className="bg-[#2A3133] p-6"><h3 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-white">{q}</h3><p className="mt-3 text-sm leading-relaxed text-white/60">{a}</p></article>)}</div>
          <button type="button" onClick={toForm} className="campaign-button mt-10 flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white md:max-w-md">{p.cta} <ArrowDown className="h-4 w-4" /></button>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black pb-24 md:pb-0">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-5 py-8 text-[11px] text-white/40 md:flex-row md:items-center md:justify-between md:px-10">
          <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#FBFF00]" /> SKILL CGN · Herzogstraße 16–20 · 50667 Köln</span>
          <span className="campaign-mono flex flex-wrap gap-4 uppercase tracking-[0.16em]"><Link to="/impressum" className="hover:text-white">Impressum</Link><Link to="/datenschutz" className="hover:text-white">Datenschutz</Link><Link to="/agb" className="hover:text-white">AGB</Link><button type="button" onClick={openCookieSettings} className="uppercase hover:text-white">Cookie-Einstellungen</button></span>
        </div>
      </footer>

      {/* 3. Feste Leiste, nur mobil und nur solange das Formular nicht im Bild ist */}
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#FBFF00] bg-black transition-transform duration-200 md:hidden ${formVisible ? "translate-y-full" : "translate-y-0"}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-hidden={formVisible}>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="campaign-mono text-[11px] uppercase tracking-[0.12em] text-white">39 € alle vier Wochen</span>
          <button type="button" onClick={toForm} tabIndex={formVisible ? -1 : 0} className="campaign-button flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black">Jetzt starten <ArrowDown className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </main>
  );
}
