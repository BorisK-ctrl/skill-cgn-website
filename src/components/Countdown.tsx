/* Laufender Black-Week-Countdown (Tage, Std, Min, Sek) nach Serverzeit, Ende 30.11.2026 23:59:59 Berlin.
   Erster Render leer (Prerender), danach jede Sekunde. Am letzten Tag "Endet heute um 23:59", nach Ablauf nichts. */
import { countdownLabel, useBlackWeekMsLeft } from "@/lib/blackweek";

export default function Countdown({ variant = "campaign", className = "" }: { variant?: "campaign" | "home"; className?: string }) {
  const left = useBlackWeekMsLeft(1000);
  if (left == null || left <= 0) return null;
  const s = Math.floor(left / 1000);
  const parts = [[Math.floor(s / 86400), "Tage"], [Math.floor(s / 3600) % 24, "Std"], [Math.floor(s / 60) % 60, "Min"], [s % 60, "Sek"]] as const;
  const lastDay = s < 86400;
  const shown = lastDay ? parts.slice(1) : parts;
  const box = variant === "campaign" ? "border-[#FBFF00] bg-black text-[#FBFF00]" : "border-primary bg-black text-primary";
  const label = variant === "campaign" ? "text-white/70" : "text-foreground/70";
  return (
    <div className={className} role="timer" aria-label={countdownLabel(left)}>
      <p className={`campaign-mono text-[10px] uppercase tracking-[0.22em] ${lastDay ? "font-bold text-[#FBFF00]" : label}`}>{lastDay ? "Endet heute um 23:59" : "Black Week endet in"}</p>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        {shown.map(([n, unit]) => (
          <div key={unit} className={`flex min-w-[64px] flex-col items-center border-2 px-2 py-2 sm:min-w-[76px] ${box}`}>
            <span className="campaign-display text-4xl leading-none tabular-nums sm:text-5xl">{String(n).padStart(2, "0")}</span>
            <span className="campaign-mono mt-1 text-[9px] uppercase tracking-[0.2em] text-white/60">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
