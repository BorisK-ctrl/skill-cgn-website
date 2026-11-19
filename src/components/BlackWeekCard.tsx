/* Tarifkarte "Gym Only, Black Week" im Stil der /memberships-Karten. Ersetzt dort bis 30.11.2026 die START-39-Karte (links).
   Kein Vergleichspreis (Issue #1, Boris 19.11.2026): weder ONLY GYM 34 € (anderer Tarif) noch 39 € (START 39 ist selbst ein Angebot). */
import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus, Zap } from "lucide-react";
import { fmtPrice } from "@/lib/useRateBundles";
import { trackCta } from "@/lib/events";

export const GYM_ONLY_FEATURES = ["Gym komplett, alle Geräte", "Dusche, Getränke, Trainingshandtuch", "3D Scan und Assessment zum Start", "Monatlich kündbar"] as const;

export default function BlackWeekCard({ now, was, big, parking }: { now: number; was: number; big: boolean; parking?: React.ReactNode }) {
  return (
    <div className={`relative flex flex-col h-full ${big ? "p-8" : "p-6"} border-2 border-primary bg-card`}>
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-foreground text-background px-5 py-1 font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Black Week · bis 30.11.</div>
      <div className="mb-5"><div className="inline-flex items-center justify-center w-10 h-10 mb-3 bg-foreground/10 text-foreground/60"><Zap className="w-5 h-5" /></div><h3 className="text-2xl font-black uppercase tracking-tight">Gym Only</h3><p className="text-xs text-foreground/50 mt-0.5">Nur online, nur Neukunden</p></div>
      <div className={big ? "mb-6 pb-6 border-b border-foreground/10" : "mb-5 pb-5 border-b border-foreground/10"}>
        <div className="flex items-end gap-2 mb-1">
          <span className={`${big ? "text-6xl" : "text-5xl"} font-black leading-none tracking-tight font-mono text-primary`}>{fmtPrice(now)}</span>
          <div className={big ? "mb-2" : "mb-1"}><span className={`${big ? "text-lg" : "text-base"} font-black text-foreground/60`}>€</span><span className={`block ${big ? "text-xs" : "text-[10px]"} text-foreground/40 font-bold uppercase`}>alle vier Wochen</span></div>
        </div>
        <p className={`${big ? "text-xs" : "text-[10px]"} text-foreground/50 leading-relaxed`}>Dauerhaft, monatlich kündbar, 0&nbsp;€ Aufnahmegebühr. Abschluss bis 30.11.2026.</p>
      </div>
      <div className="space-y-3 flex-1">
        {GYM_ONLY_FEATURES.map(f => <div key={f} className="flex items-start gap-3"><span className="w-5 h-5 bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="w-3 h-3 text-primary" /></span><span className="text-sm text-foreground/80">{f}</span></div>)}
        <div className="flex items-start gap-3"><span className="w-5 h-5 bg-foreground/10 flex items-center justify-center flex-shrink-0 mt-0.5"><Minus className="w-3 h-3 text-foreground/40" /></span><span className="text-sm text-foreground/50">Keine Classes, kein Coaching</span></div>
      </div>
      {parking}
      <Link to="/blackweek#formular" onClick={() => trackCta("cta_blackweek_memberships")} className={`mt-6 inline-flex items-center justify-center w-full font-black uppercase tracking-widest ${big ? "text-sm py-5" : "text-xs py-4"} campaign-button border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground`}>Gym Only {fmtPrice(now)}&nbsp;€ sichern <ArrowRight className="w-4 h-4 ml-2" /></Link>
    </div>
  );
}
