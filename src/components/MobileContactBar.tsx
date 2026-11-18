/* Feste Leiste unten, nur mobil: ein gelber Knopf zum aktuellen Angebot (usePromo, Ereignis cta_<angebot>_sticky).
   Anrufen und WhatsApp stehen im Footer. Auf /probetraining und /checkout ausgeblendet. */
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { trackCta } from "@/lib/events";
import { track } from "@/lib/pixel";
import { WHATSAPP } from "@/lib/magicline";
import { usePromo } from "@/lib/blackweek";

export default function MobileContactBar() {
  const p = useLocation().pathname;
  const promo = usePromo();
  if (p.startsWith("/checkout") || p.startsWith("/danke")) return null;
  if (p.startsWith("/personal-training")) return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary bg-background lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <a href={`${WHATSAPP}?text=${encodeURIComponent("Hallo Boris, ich interessiere mich für Personal Training. Wann passt ein Termin für das Assessment?")}`} target="_blank" rel="noopener noreferrer" onClick={() => { track("Contact", { content_name: "Personal Training", content_category: "PT" }); trackCta("cta_pt_whatsapp_sticky"); }} className="flex min-h-[56px] items-center justify-center gap-2 bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground"><MessageCircle className="h-4 w-4" /> Personal Training: Termin anfragen</a>
    </div>
  );
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary bg-background lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <Link to={promo.path} onClick={() => trackCta(`cta_${promo.key}_sticky`)} className="flex min-h-[56px] items-center justify-center gap-2 bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground">{promo.sticky} <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}
