/* Black-Month-Banner unter der festen Navbar, auf allen Seiten mit Navbar, bis 30.11.2026 (Gate im Layout über useBlackMonthActive). */
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import { trackCta } from "@/lib/events";

export default function BlackMonthBanner() {
  return (
    <Link to="/blackmonth" onClick={() => trackCta("cta_blackmonth_banner")} className="campaign-button relative z-20 mt-20 flex items-center justify-center gap-3 bg-primary px-4 py-3 text-center text-primary-foreground hover:bg-white">
      <Zap className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] sm:text-xs"><span className="font-black">Black Month:</span> 6 Monate Gym für 149 €, nur im November</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}
