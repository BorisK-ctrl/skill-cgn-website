/* Aktionsstempel neben dem Black-Week-Preis ("BLACK WEEK DEAL · nur bis 30.11."). Kein Preisvergleich, kein Streichpreis (Issue #1).
   Inline, damit er mit der Headline umbricht. */
export default function PriceStamp({ title = "Black Week Deal", sub = "nur bis 30.11." }: { title?: string; sub?: string }) {
  return (
    <span className="relative mb-4 ml-3 inline-block -rotate-12 border-[3px] border-[#FBFF00] px-2 pb-1 pt-1.5 align-middle font-sans text-[#FBFF00] sm:mb-0 sm:ml-5 sm:border-4 sm:px-3">
      <span className="campaign-display block whitespace-nowrap text-[26px] uppercase leading-none sm:text-4xl md:text-5xl">{title}</span>
      <span className="campaign-mono block whitespace-nowrap text-[9px] normal-case leading-none tracking-[0.18em] sm:text-[11px]">{sub}</span>
    </span>
  );
}
