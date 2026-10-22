/*
 * /vor-ort: Vertragsabschluss am Tresen auf dem iPad. Kein Marketing, kein Tracking, kein Interessent.
 * Links Tarif und Laufzeit live aus dem Magicline rate-bundle (Starter und Kraftwerk ausgeblendet), rechts das Drei-Schritt-Formular.
 * Nach dem Abschluss: Vertragsnummer, dann "Nächster Kunde". Noindex, nur per Link.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, ShieldCheck, Wifi } from "lucide-react";
import StartCheckout from "@/components/StartCheckout";
import { usePageMeta } from "@/lib/meta";
import { euro, termLabel, termFees, termCancel, type RateBundle, type RateBundleTerm, type ContractResult } from "@/lib/magicline";
import { START39_TERM_ID } from "@/lib/magicline";
import { useRateBundles, fmtPrice } from "@/lib/useRateBundles";

const LOGO_WHITE = "/img/manus/skill-cgn-original-white_18b77f12.svg";
const ORDER = ["START 39", "BACK 39", "SKILL Mitgliedschaft", "SKILL Unlimited"];
const HIDDEN = /starter|kraftwerk/i;
const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";

export default function VorOrt() {
  usePageMeta("Vor-Ort-Abschluss — SKILL CGN", "Vertrag direkt am Tresen abschließen (iPad).", "noindex,nofollow");
  const { bundles, error } = useRateBundles();
  const list = useMemo(() => {
    if (!bundles) return [] as RateBundle[];
    const known = ORDER.map(n => bundles.find(b => b.name.toLowerCase() === n.toLowerCase())).filter(Boolean) as RateBundle[];
    const rest = bundles.filter(b => !known.includes(b) && !HIDDEN.test(b.name));
    return [...known, ...rest].filter(b => b.terms?.length);
  }, [bundles]);
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(today());
  const [staff, setStaff] = useState(() => { try { return localStorage.getItem("skill-pos-staff") || ""; } catch { return ""; } });
  const [done, setDone] = useState<ContractResult | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => { try { localStorage.setItem("skill-pos-staff", staff); } catch {} }, [staff]);
  useEffect(() => { if (list.length && bundleId == null) setBundleId(list[0].id); }, [list, bundleId]);
  const bundle = list.find(b => b.id === bundleId) || null;
  const terms = useMemo(() => (bundle ? [...bundle.terms].sort((a, b) => a.termValue - b.termValue) : []), [bundle]);
  useEffect(() => { if (terms.length && !terms.some(t => t.id === termId)) setTermId(terms.find(t => t.id === START39_TERM_ID)?.id ?? terms[0].id); }, [terms, termId]);
  const term: RateBundleTerm | null = terms.find(t => t.id === termId) || null;
  const priceLine = term ? `${fmtPrice(term.price)} € alle ${term.paymentFrequencyValue} ${term.paymentFrequencyUnit === "WEEK" ? "Wochen" : "Monate"}, ${termLabel(term)}, Gebühr: ${termFees(term)}` : "";
  const onSuccess = (r: ContractResult) => { setDone(r); setCount(c => c + 1); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => { setDone(null); setStartDate(today()); };

  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-4"><img src={LOGO_WHITE} alt="SKILL CGN" className="h-6 w-auto md:h-7" width={160} height={28} /><span className="campaign-mono border border-[#FBFF00] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#FBFF00]">Vor-Ort-Abschluss</span></div>
          <div className="flex items-center gap-3">
            <label className="campaign-mono text-[10px] uppercase tracking-[0.16em] text-white/50">Berater:in</label>
            <input value={staff} onChange={e => setStaff(e.target.value)} placeholder="Kürzel" className="campaign-field !w-28 !py-2 text-center text-sm" />
            <span className="campaign-mono hidden items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-white/40 md:flex"><Wifi className="h-3.5 w-3.5" /> {count} heute</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-6 md:px-8 lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
        {/* Tarif und Laufzeit */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className={kicker}>1. Tarif</p>
          {error ? (
            <div className="mt-3 border-2 border-[#FBFF00] bg-[#2A3133] p-5"><div className="flex items-start gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#FBFF00]" /><p className="text-sm text-white/70">Magicline antwortet nicht. Seite neu laden oder WLAN prüfen.</p></div></div>
          ) : !bundles ? (
            <p className="campaign-mono mt-3 text-[10px] uppercase tracking-[0.18em] text-white/40">Tarife werden geladen …</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-px bg-white/15 md:grid-cols-3 lg:grid-cols-2">
              {list.map(b => { const active = b.id === bundleId; const min = Math.min(...b.terms.map(t => t.price)); return (
                <button key={b.id} type="button" onClick={() => { setBundleId(b.id); setDone(null); }} className={`campaign-button flex min-h-[84px] flex-col items-start justify-between p-4 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>
                  <span className="campaign-display text-2xl uppercase leading-none">{b.name}</span>
                  <span className={`campaign-mono mt-2 text-[10px] uppercase tracking-[0.14em] ${active ? "text-black/70" : "text-[#FBFF00]"}`}>ab {fmtPrice(min)} € alle 4 Wochen</span>
                </button>
              ); })}
            </div>
          )}

          {terms.length > 0 && (
            <>
              <p className={`${kicker} mt-6`}>2. Laufzeit</p>
              <div className="mt-3 grid gap-px bg-white/15" role="radiogroup" aria-label="Laufzeit">
                {terms.map(t => { const active = t.id === termId; return (
                  <button key={t.id} type="button" role="radio" aria-checked={active} onClick={() => setTermId(t.id)} className={`campaign-button flex min-h-[64px] items-center gap-3 p-4 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${active ? "border-black bg-black text-[#FBFF00]" : "border-white/40"}`}>{active && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase tracking-[0.08em]">{termLabel(t)}</span><span className={`block text-xs ${active ? "text-black/70" : "text-white/55"}`}>{termCancel(t)} · Gebühr: {termFees(t)}</span></span>
                    <span className="campaign-display text-2xl leading-none">{euro(t.price)}</span>
                  </button>
                ); })}
              </div>
              <p className={`${kicker} mt-6`}>3. Start</p>
              <input type="date" value={startDate} min={today()} onChange={e => setStartDate(e.target.value)} className="campaign-field mt-3 min-h-[52px] text-base" />
              <p className="mt-2 text-xs text-white/45">Heute vorbelegt. Erste Abbuchung zum Startdatum.</p>
            </>
          )}
        </aside>

        {/* Formular */}
        <section className="mt-8 lg:mt-0">
          {done ? (
            <div className="border-2 border-[#FBFF00] bg-[#1a2224] p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center bg-[#FBFF00]"><Check className="h-7 w-7 text-black" /></div>
              <h2 className="campaign-display mt-5 text-4xl uppercase leading-none md:text-5xl">Vertrag angelegt.</h2>
              <p className="mt-4 text-sm text-white/70">Kunde {done.customerNumber} · Vertrag {done.contractId}. Die Bestätigung mit allen Unterlagen geht per E-Mail raus.</p>
              <button type="button" onClick={next} className="campaign-button mt-8 inline-flex min-h-14 items-center gap-3 bg-[#FBFF00] px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white"><RotateCcw className="h-4 w-4" /> Nächster Kunde</button>
            </div>
          ) : (
            <StartCheckout term={term} offerName={bundle?.name || "Mitgliedschaft"} path="/vor-ort" priceLine={priceLine} pos={{ staff, startDate }} onSuccess={onSuccess} />
          )}
        </section>
      </div>
    </main>
  );
}
