/* Feste Leiste unten, nur mobil: ein gelber Knopf zum aktuellen Angebot (usePromo, Ereignis cta_<angebot>_sticky).
   Anrufen und WhatsApp stehen im Footer. Auf /probetraining und /checkout ausgeblendet. */
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { trackCta } from "@/lib/events";
import { track } from "@/lib/pixel";
import { WHATSAPP } from "@/lib/magicline";
import { usePromo } from "@/lib/blackweek";

export default function MobileContactBar() {
  const p = useLocation().pathname;
  const promo = usePromo();
  /* Nie zwei gleiche Knöpfe übereinander: Leiste aus, solange ein Angebotsknopf der Seite ([data-promo-cta]) im Bild ist
     oder der erste davon noch unterhalb liegt (Seite ganz oben, Hero-Knopf sichtbar). */
  const [hide, setHide] = useState(false);
  useEffect(() => {
    let io: IntersectionObserver | null = null; let tries = 0; const seen = new Map<Element, boolean>();
    const attach = () => {
      const els = [...document.querySelectorAll("[data-promo-cta]")];
      if (!els.length) { if (++tries < 20) t = window.setTimeout(attach, 150); else setHide(false); return; }
      io = new IntersectionObserver(es => {
        es.forEach(e => seen.set(e.target, e.isIntersecting || (e.target === els[0] && e.boundingClientRect.top > 0)));
        setHide([...seen.values()].some(Boolean));
      });
      els.forEach(el => io!.observe(el));
    };
    let t = window.setTimeout(attach, 0);
    return () => { window.clearTimeout(t); io?.disconnect(); };
  }, [p]);
  if (p.startsWith("/checkout") || p.startsWith("/danke") || p.startsWith("/probetraining")) return null; // Probetraining: gelbe Leiste sähe aus wie der Buchen-Knopf
  if (p.startsWith("/personal-training")) return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary bg-background lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <a href={`${WHATSAPP}?text=${encodeURIComponent("Hallo Boris, ich interessiere mich für Personal Training. Wann passt ein Termin für das Assessment?")}`} target="_blank" rel="noopener noreferrer" onClick={() => { track("Contact", { content_name: "Personal Training", content_category: "PT" }); trackCta("cta_pt_whatsapp_sticky"); }} className="flex min-h-[56px] items-center justify-center gap-2 bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground"><MessageCircle className="h-4 w-4" /> Personal Training: Termin anfragen</a>
    </div>
  );
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary bg-background transition-transform duration-200 lg:hidden ${hide ? "translate-y-full" : "translate-y-0"}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-hidden={hide}>
      <Link to={promo.formPath} tabIndex={hide ? -1 : 0} onClick={() => trackCta(`cta_${promo.key}_sticky`)} className="flex min-h-[56px] items-center justify-center gap-2 bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground">{promo.sticky} <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}
