/* Hochkant-Video (9:16) mit eingebrannten Untertiteln: startet stumm, sobald es fast im Bild ist, Ton per Knopf.
   Bei prefers-reduced-motion kein Autoplay, nur Poster mit Play-Knopf. Quelle per src + load(), sonst zeigt Safari kein Bild. */
import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

export default function PromoVideo({ src, poster, label, className = "" }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState<string | undefined>(undefined);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(src); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el); return () => io.disconnect();
  }, [src]);
  useEffect(() => { const v = ref.current; if (!on || !v) return; v.load(); v.play().catch(() => {}); }, [on]);
  const start = () => { const v = ref.current; if (!v) return; if (!on) setOn(src); else v.play().catch(() => {}); };
  const toggleSound = () => {
    const v = ref.current; if (!v) return;
    const next = !muted; v.muted = next; setMuted(next);
    if (!next) { v.currentTime = 0; v.play().catch(() => {}); }
  };
  return (
    <div className={`relative border-2 border-primary bg-black ${className}`}>
      <video ref={ref} src={on} poster={poster} muted={muted} loop playsInline preload="none" aria-label={label} width={720} height={1280}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="block aspect-[9/16] w-full object-cover" />
      {!playing && <button type="button" onClick={start} aria-label="Video abspielen" className="absolute inset-0 flex items-center justify-center"><span className="flex h-16 w-16 items-center justify-center bg-primary text-black"><Play className="h-7 w-7" /></span></button>}
      {playing && <button type="button" onClick={toggleSound} aria-label={muted ? "Ton an" : "Ton aus"}
        className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/80 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white hover:text-primary">
        {muted ? <><VolumeX className="h-4 w-4" /> Ton an</> : <><Volume2 className="h-4 w-4" /> Ton aus</>}</button>}
    </div>
  );
}
