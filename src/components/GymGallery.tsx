/*
 * Bildkarussell "Ein Blick ins Gym". Horizontal scrollbar mit Snap, Pfeilen und Zähler.
 * Bilder aus public/img/gym (WebP, 3:4). variant "home" nutzt die Tailwind-Tokens der Startseite,
 * variant "campaign" die Kampagnen-Klassen der START 39 Landingpage.
 */
import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const GYM_IMAGES = [
  { file: "01-sprintbahn", label: "Kunstrasenbahn", text: "Kunstrasenbahn für Sled Push und Sled Pull. Race-Bedingungen, jeden Tag." },
  { file: "02-laufbaender", label: "Laufbänder", text: "High End Laufbänder von Technogym. Maximale Leistung für Hybrid Athleten." },
  { file: "03-stepper-cardio", label: "Cardio", text: "Cardio auf Profi-Niveau. Ausdauer, die im Wettkampf trägt." },
  { file: "04-geraetepark", label: "Gerätepark", text: "Technogym Selection 900: Biomechanik nach natürlicher Bewegung, in Sekunden eingestellt. Kraft ohne Umwege." },
  { file: "05-kurzhanteln", label: "Kurzhanteln", text: "Kurzhanteln, Kettlebells, Freihanteln. Alles, was echte Kraft braucht." },
  { file: "06-kabelzug", label: "Kabelzug", text: "Kabelzug für jede Bewegungsebene. Funktionelle Kraft, wie der Sport sie fordert." },
  { file: "07-hyrox-schlitten", label: "HYROX Schlitten", text: "Offizielle HYROX Schlitten von Centr. Trainieren wie beim Race." },
  { file: "08-indoor-cycling", label: "Indoor Cycling", text: "Technogym Bikes für Intervalle mit Biss. Beine, Lunge, Kopf." },
  { file: "09-scaneca-3d-scan", label: "Scaneca 3D-Scan", text: "3D-Körperscan zum Start. Dein Fortschritt in Zahlen, nicht im Gefühl." },
  { file: "10-beinpresse", label: "Pure Strength", text: "Technogym Pure Strength im Beinbereich: Scheiben statt Steckgewichte, Bewegung wie mit der Langhantel. Optimales Training für maximale Beinkraft." },
  { file: "11-wasserbar", label: "Wasserbar", text: "Mineraldrink für volle Hydration, inklusive. Auffüllen, weitermachen." },
  { file: "12-duschen", label: "Duschen", text: "Moderne Duschen und Umkleiden. Nach dem Training direkt weiter in den Tag." },
] as const;

type Variant = "home" | "campaign";

const styles: Record<Variant, { card: string; label: string; text: string; arrow: string; counter: string; track: string }> = {
  home: {
    card: "bg-card border border-foreground/10",
    label: "font-mono text-xs uppercase tracking-widest text-primary",
    text: "text-foreground/60 text-sm leading-relaxed",
    arrow: "w-11 h-11 bg-background/80 backdrop-blur-sm border border-foreground/20 rounded-full flex items-center justify-center text-foreground/70 hover:text-primary hover:border-primary transition-all disabled:opacity-30 disabled:hover:text-foreground/70 disabled:hover:border-foreground/20",
    counter: "font-mono text-xs tracking-widest text-foreground/50",
    track: "bg-foreground/10",
  },
  campaign: {
    card: "bg-[#2A3133] border border-white/10",
    label: "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]",
    text: "text-sm leading-relaxed text-white/65",
    arrow: "campaign-button w-11 h-11 border-2 border-[#FBFF00] flex items-center justify-center text-[#FBFF00] hover:bg-[#FBFF00] hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#FBFF00]",
    counter: "campaign-mono text-[10px] tracking-[0.22em] text-white/40",
    track: "bg-white/15",
  },
};

export default function GymGallery({ variant, limit }: { variant: Variant; limit?: number }) {
  const s = styles[variant];
  const images = limit ? GYM_IMAGES.slice(0, limit) : GYM_IMAGES;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const n = images.length;

  const cardStep = (el: HTMLDivElement) => {
    const first = el.firstElementChild as HTMLElement | null;
    const second = first?.nextElementSibling as HTMLElement | null;
    return first && second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
  };
  const handleScroll = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    const idx = Math.round(el.scrollLeft / cardStep(el));
    setActive(Math.max(0, Math.min(n - 1, idx)));
  }, [n]);
  const go = (idx: number) => {
    const el = scrollRef.current; if (!el) return;
    const i = Math.max(0, Math.min(n - 1, idx));
    el.scrollTo({ left: cardStep(el) * i, behavior: "smooth" });
    setActive(i);
  };

  return (
    <div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 md:gap-5 scroll-smooth" aria-label="Bilder aus dem Gym">
        {images.map((img, idx) => (
          <figure key={img.file} className={`snap-start flex-shrink-0 w-[78vw] sm:w-[340px] lg:w-[380px] ${s.card}`}>
            <img
              src={`/img/gym/${img.file}.webp`}
              srcSet={`/img/gym/${img.file}-m.webp 720w, /img/gym/${img.file}.webp 1080w`}
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 340px, 78vw"
              width={1080} height={1440}
              loading={idx < 4 ? "eager" : "lazy"} decoding="async"
              alt={`${img.label} bei SKILL CGN in Köln`}
              className="block aspect-[3/4] w-full object-cover" />
            <figcaption className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className={s.label}>{img.label}</span>
                <span className={s.counter}>{String(idx + 1).padStart(2, "0")}</span>
              </div>
              <p className={`mt-1.5 ${s.text}`}>{img.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-6">
        <div className={`relative h-px flex-1 ${s.track}`} aria-hidden="true">
          <div className={`absolute left-0 top-0 h-px transition-all duration-300 ${variant === "home" ? "bg-primary" : "bg-[#FBFF00]"}`} style={{ width: `${((active + 1) / n) * 100}%` }} />
        </div>
        <span className={s.counter}>{String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => go(active - 1)} disabled={active === 0} className={s.arrow} aria-label="Vorheriges Bild"><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" onClick={() => go(active + 1)} disabled={active === n - 1} className={s.arrow} aria-label="Nächstes Bild"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}
