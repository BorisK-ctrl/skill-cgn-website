/*
 * /vor-ort: Vertragsabschluss am Tresen auf dem iPad, zwei Modi.
 * Team-Modus: Tarif, Laufzeit, Start und Kürzel wählen, dann "iPad an Kunden übergeben".
 * Kunden-Modus: nur ein Angebot, drei kurze Schritte, Unterschrift, fertig. Keine Links nach außen, kein Hinweis auf "zu Hause",
 * kein Tarifvergleich, kein Tracking. Nach dem Abschluss Willkommensbild, nach 30 Sekunden oder per Tipp zurück ins Team.
 * Vertrag entsteht sofort in Magicline (Connect API), Zahlart SEPA. Noindex, nur per Link.
 * Black Week (bis 30.11.2026, Boris 19.11.): Deal steht vorn und ist vorausgewählt, Kundenansicht wie /blackweek (Gym Only ohne Kurse,
 * 0 € Aufnahmegebühr aus dem rate-bundle), Start immer heute (contractStartType CONTRACT_CONCLUSION). Ab 1.12. verschwindet er von selbst.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Lock, RotateCcw, ShieldCheck, Tablet } from "lucide-react";
import StartCheckout from "@/components/StartCheckout";
import { usePageMeta } from "@/lib/meta";
import { euro, termLabel, termFees, termCancel, type RateBundle, type RateBundleTerm, type ContractResult } from "@/lib/magicline";
import { START39_TERM_ID } from "@/lib/magicline";
import { useRateBundles, fmtPrice } from "@/lib/useRateBundles";
import { TARIFE } from "@/lib/tarife";
import { BLACK_WEEK, blackWeekActive } from "@/lib/blackweek";
import { berlinToday } from "@/lib/blackmonth";

const LOGO_WHITE = "/img/manus/skill-cgn-original-white_18b77f12.svg";
const ORDER = ["START 39", "BACK 39", "SKILL Mitgliedschaft", "SKILL Unlimited"];
const HIDDEN = /starter|kraftwerk/i;
const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";
const isBW = (b: { id: number } | null | undefined) => b?.id === BLACK_WEEK.rateBundleId;
const GYM_ONLY = /only gym|gym only/i;
/* StartCheckout merkt sich Formular, Schritt und Interessent im sessionStorage (Schlüssel je Seite). Am Tresen vor und nach jedem Kunden leeren,
   sonst sieht der nächste Kunde die Daten des vorigen und sein Vertrag hängt am falschen Interessenten (Prüfung 19.11.2026). */
const POS_KEY = "skill-checkout-vor-ort";
const clearPosSession = () => { try { sessionStorage.removeItem(POS_KEY); } catch {} };
const BW_END = new Date(BLACK_WEEK.end + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
/** Leistungen je Angebot für die Kundenansicht, aus den Tarifdaten. Gym Only ohne Kurse; Black Week laut Magicline mit Dusche, Getränken, Handtuch.
    Unbekannte Angebote nur mit dem, was sicher drin ist (keine Kurse versprechen). */
function benefits(b: RateBundle): string[] {
  if (isBW(b)) return ["Gym komplett, alle Geräte", "Dusche, Getränke, Trainingshandtuch", "3D Scan und Assessment zum Start"];
  if (GYM_ONLY.test(b.name)) return ["Gym komplett, alle Geräte"];
  if (/back 39/i.test(b.name)) return ["Volles Gym", "4 Classes im Monat", "Kostenloser 3D Scan zum Start"];
  const t = TARIFE.find(x => x.name.toLowerCase() === b.name.toLowerCase());
  return (t?.features || ["Volles Gym"]).slice(0, 4);
}
const fmtDe = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

export default function VorOrt() {
  usePageMeta("Vor-Ort-Abschluss — SKILL CGN", "Vertrag direkt am Tresen abschließen (iPad).", "noindex,nofollow");
  const { bundles, error } = useRateBundles();
  const list = useMemo(() => {
    if (!bundles) return [] as RateBundle[];
    /* Black Week nur bis 30.11. (Berliner Datum), dann vorn und damit vorausgewählt */
    const visible = bundles.filter(b => b.terms?.length && !HIDDEN.test(b.name) && (!isBW(b) || blackWeekActive()));
    const known = ORDER.map(n => visible.find(b => b.name.toLowerCase() === n.toLowerCase())).filter(Boolean) as RateBundle[];
    const rest = visible.filter(b => !known.includes(b) && !isBW(b));
    return [...visible.filter(isBW), ...known, ...rest];
  }, [bundles]);
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(today());
  const [staff, setStaff] = useState(() => { try { return localStorage.getItem("skill-pos-staff") || ""; } catch { return ""; } });
  const [mode, setMode] = useState<"team" | "kunde" | "fertig">("team");
  const [done, setDone] = useState<{ r: ContractResult; firstName: string } | null>(null);
  const [count, setCount] = useState(0);
  const backTimer = useRef<number>(0);
  useEffect(() => { try { localStorage.setItem("skill-pos-staff", staff); } catch {} }, [staff]);
  useEffect(() => { if (list.length && bundleId == null) setBundleId(list[0].id); }, [list, bundleId]);
  const bundle = list.find(b => b.id === bundleId) || null;
  const terms = useMemo(() => (bundle ? [...bundle.terms].sort((a, b) => a.termValue - b.termValue) : []), [bundle]);
  useEffect(() => { if (terms.length && !terms.some(t => t.id === termId)) setTermId(terms.find(t => t.id === START39_TERM_ID)?.id ?? terms[0].id); }, [terms, termId]);
  const term: RateBundleTerm | null = terms.find(t => t.id === termId) || null;
  /* Black Week startet immer am Tag des Abschlusses: kein Datumsfeld, Start heute (bei jedem Rendern neu, nicht aus dem Stand von gestern) */
  const bw = isBW(bundle);
  const start = bw ? today() : startDate;
  const fee = term ? termFees(term) : "";
  const priceLine = term ? `${fmtPrice(term.price)} € alle ${term.paymentFrequencyValue} ${term.paymentFrequencyUnit === "WEEK" ? "Wochen" : "Monate"}, ${termLabel(term)}, ${termFees(term) === "keine" ? "0 € Aufnahmegebühr" : "Gebühr: " + termFees(term)}` : "";

  /* Das iPad bleibt tagelang offen. Neuer Tag (Köln): im Team-Modus neu laden, damit Angebote, Black-Week-Ende und Starttag stimmen.
     Kundenansicht ohne Eingabe: nach 10 Minuten zurück ins Team (Daten weg), an einem neuen Tag oder nach Ende der Black Week schon nach 1 Minute.
     Die Übergabe prüft vorher selbst. */
  const loadedDay = useRef(berlinToday());
  const newDay = () => berlinToday() !== loadedDay.current;
  const lastInput = useRef(Date.now());
  const onSuccess = (r: ContractResult, info: { firstName: string }) => { setDone({ r, firstName: info.firstName }); setCount(c => c + 1); setMode("fertig"); window.scrollTo({ top: 0 }); };
  const backToTeam = () => { window.clearTimeout(backTimer.current); clearPosSession(); if (newDay()) { window.location.reload(); return; } setDone(null); setStartDate(today()); setMode("team"); window.scrollTo({ top: 0 }); };
  /* Übergabe: neuer Tag oder Black Week vorbei → erst neu laden; jeder Kunde beginnt leer */
  const handover = () => { if (newDay() || (bw && !blackWeekActive())) { window.location.reload(); return; } clearPosSession(); lastInput.current = Date.now(); setMode("kunde"); window.scrollTo({ top: 0 }); };
  const live = useRef({ mode, bw, backToTeam }); live.current = { mode, bw, backToTeam };
  useEffect(() => {
    clearPosSession(); // Reste eines abgebrochenen Kunden, etwa vor einem Neuladen
    const mark = () => { lastInput.current = Date.now(); };
    const inputs = ["pointerdown", "keydown", "input"] as const;
    inputs.forEach(e => document.addEventListener(e, mark, true));
    const check = () => {
      const { mode: m, bw: isDeal, backToTeam: back } = live.current, idle = Date.now() - lastInput.current;
      if (m === "team") { if (newDay()) window.location.reload(); return; }
      if (m === "kunde" && (idle >= 10 * 60000 || ((newDay() || (isDeal && !blackWeekActive())) && idle >= 60000))) back();
    };
    const t = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", check); inputs.forEach(e => document.removeEventListener(e, mark, true)); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* Willkommensbild läuft nach 30 Sekunden von selbst zurück ins Team */
  useEffect(() => { if (mode !== "fertig") return; backTimer.current = window.setTimeout(backToTeam, 30000); return () => window.clearTimeout(backTimer.current); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Dreifach-Tipp auf das Logo holt das Team zurück, ohne dass der Kunde einen "Abbrechen"-Knopf sieht */
  const taps = useRef<number[]>([]);
  const logoTap = () => { const now = Date.now(); taps.current = [...taps.current.filter(t => now - t < 1500), now]; if (taps.current.length >= 3) { taps.current = []; backToTeam(); } };

  /* ---------- Kunden-Modus ---------- */
  if (mode === "kunde" && bundle && term) {
    return (
      <main className="campaign-page min-h-screen bg-black text-white">
        <header className="border-b border-white/10 bg-black"><div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-5"><img src={LOGO_WHITE} alt="SKILL CGN" className="h-7 w-auto select-none" width={160} height={28} onClick={logoTap} draggable={false} /><span className={kicker}>Herzogstraße 16–20 · Köln</span></div></header>
        <div className="mx-auto max-w-[1180px] px-6 py-8 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className={kicker}>{bw ? `Black Week Deal · nur bis ${BW_END.slice(0, 6)}` : "Dein Angebot"}</p>
            <h1 className="campaign-display mt-3 text-6xl uppercase leading-[0.85] md:text-7xl">{bw ? "Gym Only" : bundle.name}</h1>
            <p className="mt-5 flex items-baseline gap-2"><span className="campaign-display text-7xl leading-none text-[#FBFF00] md:text-8xl">{fmtPrice(term.price)} €</span><span className="campaign-mono text-xs uppercase tracking-[0.18em] text-white/60">alle {term.paymentFrequencyValue} {term.paymentFrequencyUnit === "WEEK" ? "Wochen" : "Monate"}</span></p>
            <ul className="mt-6 space-y-3">
              {benefits(bundle).map(b => <li key={b} className="flex items-center gap-3 text-lg font-bold"><span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-4 w-4 text-black" /></span>{b}</li>)}
            </ul>
            {GYM_ONLY.test(bundle.name) && <p className="mt-4 text-sm text-white/70"><span className="font-bold text-white">Nicht drin: Kurse und Coaching.</span></p>}
            <dl className="mt-6 grid gap-px bg-white/15 text-sm">
              <div className="flex justify-between bg-[#1a2224] px-4 py-3"><dt className="text-white/55">Laufzeit</dt><dd className="font-bold">{termLabel(term)}</dd></div>
              <div className="flex justify-between bg-[#1a2224] px-4 py-3"><dt className="text-white/55">Kündigung</dt><dd className="font-bold">{termCancel(term)}</dd></div>
              {fee === "keine"
                ? <div className="flex justify-between bg-[#1a2224] px-4 py-3"><dt className="text-white/55">Aufnahmegebühr</dt><dd className={`font-bold ${bw ? "text-[#FBFF00]" : ""}`}>0&nbsp;€</dd></div>
                : <div className="flex justify-between bg-[#1a2224] px-4 py-3"><dt className="text-white/55">Gebühr</dt><dd className="font-bold">{fee}</dd></div>}
              <div className="flex justify-between bg-[#1a2224] px-4 py-3"><dt className="text-white/55">Start</dt><dd className="font-bold">{bw ? "Heute, " : ""}{fmtDe(start)}</dd></div>
            </dl>
            {bw && <p className="mt-4 text-xs text-white/55">Nur bis {BW_END}. Nicht für Mitglieder mit laufendem Vertrag. Preis inkl. MwSt.</p>}
            <p className="mt-5 flex items-center gap-2 text-xs text-white/45"><Lock className="h-3.5 w-3.5" /> Deine Daten gehen direkt in unser Mitgliedersystem, nichts wird auf diesem iPad gespeichert.</p>
          </aside>
          <section className="mt-8 lg:mt-0">
            <StartCheckout term={term} offerName={bundle.name} path="/vor-ort" priceLine={priceLine} pos={{ staff, startDate: start }} startToday={bw} onSuccess={onSuccess} />
          </section>
        </div>
      </main>
    );
  }

  /* ---------- Willkommensbild ---------- */
  if (mode === "fertig" && done) {
    return (
      <main className="campaign-page flex min-h-screen items-center justify-center bg-black text-white">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center bg-[#FBFF00]"><Check className="h-10 w-10 text-black" /></div>
          <h1 className="campaign-display mt-8 text-7xl uppercase leading-[0.85] md:text-8xl">Willkommen,<br /><span className="text-[#FBFF00]">{done.firstName || "im Team"}.</span></h1>
          <p className="mt-6 text-lg text-white/75">Dein Vertrag ist angelegt. Die Unterlagen kommen per E-Mail. Jetzt machen wir deinen Scan-Termin aus.</p>
          <p className="campaign-mono mt-6 text-[10px] uppercase tracking-[0.18em] text-white/40">Kunde {done.r.customerNumber} · Vertrag {done.r.contractId}</p>
          <button type="button" onClick={backToTeam} className="campaign-button mt-10 inline-flex min-h-14 items-center gap-3 border-2 border-white/30 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white hover:border-[#FBFF00] hover:text-[#FBFF00]"><RotateCcw className="h-4 w-4" /> Nächster Kunde</button>
        </div>
      </main>
    );
  }

  /* ---------- Team-Modus ---------- */
  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4"><img src={LOGO_WHITE} alt="SKILL CGN" className="h-6 w-auto md:h-7" width={160} height={28} /><span className="campaign-mono border border-[#FBFF00] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#FBFF00]">Team · Vor-Ort-Abschluss</span></div>
          <div className="flex items-center gap-3">
            <label className="campaign-mono text-[10px] uppercase tracking-[0.16em] text-white/50" htmlFor="pos-staff">Berater:in</label>
            <input id="pos-staff" value={staff} onChange={e => setStaff(e.target.value)} placeholder="Kürzel" className="campaign-field !w-28 !py-2 text-center text-sm" />
            <span className="campaign-mono hidden text-[10px] uppercase tracking-[0.16em] text-white/40 md:inline">{count} heute</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1180px] px-6 py-8">
        <p className={kicker}>1. Tarif</p>
        {error ? (
          <div className="mt-3 border-2 border-[#FBFF00] bg-[#2A3133] p-5"><div className="flex items-start gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#FBFF00]" /><p className="text-sm text-white/70">Magicline antwortet nicht. Seite neu laden oder WLAN prüfen.</p></div></div>
        ) : !bundles ? (
          <p className="campaign-mono mt-3 text-[10px] uppercase tracking-[0.18em] text-white/40">Tarife werden geladen …</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-px bg-white/15 md:grid-cols-4">
            {list.map(b => { const active = b.id === bundleId; const min = Math.min(...b.terms.map(t => t.price)); return (
              <button key={b.id} type="button" onClick={() => setBundleId(b.id)} className={`campaign-button flex min-h-[96px] flex-col items-start justify-between p-4 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>
                {isBW(b) && <span className={`campaign-mono mb-2 border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${active ? "border-black text-black" : "border-[#FBFF00] text-[#FBFF00]"}`}>Black Week · bis {BW_END.slice(0, 6)}</span>}
                <span className="campaign-display text-2xl uppercase leading-none">{b.name}</span>
                <span className={`campaign-mono mt-2 text-[10px] uppercase tracking-[0.14em] ${active ? "text-black/70" : "text-[#FBFF00]"}`}>ab {fmtPrice(min)} € alle 4 Wochen</span>
              </button>
            ); })}
          </div>
        )}
        {terms.length > 0 && (
          <div className="mt-8 grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className={kicker}>2. Laufzeit</p>
              <div className="mt-3 grid gap-px bg-white/15" role="radiogroup" aria-label="Laufzeit">
                {terms.map(t => { const active = t.id === termId; return (
                  <button key={t.id} type="button" role="radio" aria-checked={active} onClick={() => setTermId(t.id)} className={`campaign-button flex min-h-[64px] items-center gap-3 p-4 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${active ? "border-black bg-black text-[#FBFF00]" : "border-white/40"}`}>{active && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase tracking-[0.08em]">{termLabel(t)}</span><span className={`block text-xs ${active ? "text-black/70" : "text-white/55"}`}>{termCancel(t)} · Gebühr: {termFees(t)}</span></span>
                    <span className="campaign-display text-2xl leading-none">{euro(t.price)}</span>
                  </button>
                ); })}
              </div>
            </div>
            <div>
              <p className={kicker}>3. Start</p>
              {bw ? <>
                <p className="campaign-field mt-3 flex min-h-[52px] items-center text-base font-bold">Heute, {fmtDe(start)}</p>
                <p className="mt-2 text-xs text-white/45">Der Black Week Deal startet immer am Tag des Abschlusses.</p>
              </> : <>
                <input type="date" value={startDate} min={today()} onChange={e => setStartDate(e.target.value)} className="campaign-field mt-3 min-h-[52px] text-base" aria-label="Startdatum" />
                <p className="mt-2 text-xs text-white/45">Heute vorbelegt. Erste Abbuchung zum Startdatum.</p>
              </>}
            </div>
          </div>
        )}
        {term && (
          <div className="mt-10 border-2 border-[#FBFF00] bg-[#1a2224] p-6 md:flex md:items-center md:justify-between md:gap-6">
            <div><p className={kicker}>Bereit zur Übergabe</p><p className="mt-2 text-lg font-bold">{bundle?.name} · {fmtPrice(term.price)} € alle 4 Wochen · {termLabel(term)} · Start {bw ? "heute" : fmtDe(startDate)}</p><p className="mt-1 text-sm text-white/55">Der Kunde sieht nur dieses Angebot und die drei Schritte. Dreifach-Tipp auf das Logo holt dich zurück.</p></div>
            <button type="button" onClick={handover} className="campaign-button mt-5 inline-flex min-h-16 w-full items-center justify-center gap-3 bg-[#FBFF00] px-8 py-4 text-base font-bold uppercase tracking-[0.14em] text-black hover:bg-white md:mt-0 md:w-auto"><Tablet className="h-5 w-5" /> iPad an Kunden übergeben <ArrowRight className="h-5 w-5" /></button>
          </div>
        )}
      </div>
    </main>
  );
}
