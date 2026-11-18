/* Bildstrecke im Startseiten-Hero während Black Week: vier Gym-Fotos im Wechsel mit langsamem Zoom, Preis darüber.
   Erstes Bild sofort (Prerender), weitere erst nach dem Mount. Bei prefers-reduced-motion kein Zoom und kein Wechsel. */
import { useEffect, useState } from "react";

const SLIDES = [
  { src: "/img/gym/04-geraetepark.webp", label: "Geräte für jeden Muskel, in Sekunden eingestellt" },
  { src: "/img/gym/01-sprintbahn.webp", label: "Sprinten, schieben, ziehen auf Kunstrasen" },
  { src: "/img/gym/07-hyrox-schlitten.webp", label: "Trainieren im HYROX Official Gym" },
  { src: "/img/gym/05-kurzhanteln.webp", label: "Freie Gewichte, so viel du brauchst" },
] as const;

export default function HeroSlideshow({ price }: { price: string }) {
  const [i, setI] = useState(0); const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI(n => (n + 1) % SLIDES.length), 4500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 overflow-hidden border-2 border-primary bg-black aspect-[4/5]">
      {SLIDES.map((s, n) => (n === 0 || ready) && (
        <img key={s.src} src={s.src} alt={n === 0 ? "Gym bei SKILL CGN in Köln: Technogym, Kunstrasenbahn, HYROX Schlitten, Freihanteln" : ""} aria-hidden={n === 0 ? undefined : true}
          width={1080} height={1440} loading={n === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-safe:animate-[kenburns_9s_ease-out_infinite_alternate] ${n === i ? "opacity-100" : "opacity-0"}`} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{SLIDES[i].label}</p>
        <p className="campaign-display mt-1 text-6xl uppercase leading-none text-white">{price}&nbsp;€<span className="ml-2 font-mono text-xs normal-case tracking-[0.14em] text-white/70">alle 4 Wochen</span></p>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">{SLIDES.map((s, n) => <span key={s.src} className={`h-1 transition-all duration-500 ${n === i ? "w-8 bg-primary" : "w-3 bg-white/30"}`} />)}</div>
      </div>
    </div>
  );
}
