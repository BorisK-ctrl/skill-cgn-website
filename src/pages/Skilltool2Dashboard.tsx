/* /skilltool2/dashboard: internes KPI-Dashboard (Boris 21.11.2026), mobil zuerst. Daten von /api/skilltool2/kpi (nur mit Sitzung),
   alle 5 Minuten neu. Ohne Sitzung zurück zur Passwortseite. Keine Personendaten, Verträge nur als Nummer, Tag und Quelle.
   Farben laut Auftrag: Fläche #2A3133, Karten #343C3F, Gelb #FBFF00 (Meta), Blau #6FA8FF (Google), Grün #4DFF88, Rot #FF4D4D. */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Pencil, RefreshCw } from "lucide-react";
import { usePageMeta } from "@/lib/meta";

type Ampel = { farbe: "grau" | "gruen" | "gelb" | "rot"; text: string };
interface Day { date: string; meta?: number; google?: number; link_clicks?: number; junk_clicks?: number; lpv?: number; purchases_meta?: number; partial?: boolean; starts: number; payment: number; contracts: number }
interface Ad { name: string; id?: string; spend?: number; ctr?: number; cpc?: number; purchases_meta?: number; status?: string; share: number }
interface Kpi {
  campaign: string; campaigns: string[]; stand: string; updatedAt: string; plan: { name?: string; start?: string; ende?: string };
  tag: { x: number; y: number } | null;
  totals: { spend_meta: number; spend_google: number; spend: number; contracts: number; cpa: number | null; ampel: Ampel };
  funnel: { clicks: number; starts: number; payment: number; contracts: number };
  contracts: { date: string; contractId: string; source: string }[]; tests_hidden: number;
  days: Day[]; ads: Ad[]; google: { impressions?: number; clicks?: number; ctr?: number; cpc?: number; spend?: number; conversions?: number }; next: string; open: string[];
}

const C = { bg: "#2A3133", card: "#343C3F", gelb: "#FBFF00", blau: "#6FA8FF", gruen: "#4DFF88", rot: "#FF4D4D", neben: "#B8C0C3" };
const eur = (n?: number | null, d = 2) => n == null ? "—" : n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
const int = (n?: number) => (n ?? 0).toLocaleString("de-DE");
const pct = (n?: number) => n == null ? "—" : n.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " %";
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const PILL: Record<Ampel["farbe"], string> = { grau: "bg-[#B8C0C3] text-[#2A3133]", gruen: "bg-[#4DFF88] text-[#2A3133]", gelb: "bg-[#FBFF00] text-black", rot: "bg-[#FF4D4D] text-[#2A3133]" };
const card = "bg-[#343C3F] p-4";
const kicker = "font-mono text-[11px] uppercase tracking-[0.16em] text-[#B8C0C3]";
const field = "mt-1 block min-h-11 w-full border border-white/20 bg-[#2A3133] px-3 font-mono text-sm text-white outline-none focus:border-[#FBFF00]";

export default function Skilltool2Dashboard() {
  usePageMeta("SKILLTOOL2 · Dashboard", "Internes Dashboard.", "noindex,nofollow");
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const campaign = params.get("campaign") || "";
  const [kpi, setKpi] = useState<Kpi | null>(null), [err, setErr] = useState(""), [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/skilltool2/kpi${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ""}`, { credentials: "same-origin", cache: "no-store" });
      if (r.status === 401 || r.status === 503) { nav("/skilltool2", { replace: true }); return; }
      if (!r.ok) throw new Error(String(r.status));
      setKpi(await r.json()); setErr("");
    } catch { setErr("Daten nicht erreichbar. Gleich noch einmal."); }
    setLoading(false);
  }, [campaign, nav]);
  useEffect(() => { load(); const t = window.setInterval(load, 5 * 60000); return () => window.clearInterval(t); }, [load]);

  if (!kpi) return (
    <main className="flex min-h-screen items-center justify-center bg-[#2A3133] px-4 text-white">
      {err ? <p className="border-l-4 border-[#FF4D4D] pl-3 text-sm font-bold">{err}</p> : <Loader2 className="h-6 w-6 animate-spin text-[#FBFF00]" aria-label="Lädt" />}
    </main>
  );
  const t = kpi.totals, f = kpi.funnel;
  const noAds = !kpi.days.some(d => d.meta || d.google) && !kpi.ads.length;
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#2A3133] px-4 pb-10 pt-4 font-sans text-white">
      <div className="mx-auto max-w-3xl">
        {/* Kopf */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={kicker}>SKILLTOOL2</p>
            <h1 className="mt-1 font-display text-4xl uppercase leading-[0.95] [overflow-wrap:anywhere]">{kpi.plan.name || kpi.campaign}</h1>
            <p className="mt-1 font-mono text-xs text-[#B8C0C3]">{kpi.stand ? `Stand ${kpi.stand}` : "Noch keine Werbezahlen"}{kpi.tag ? ` · Tag ${kpi.tag.x} von ${kpi.tag.y}` : ""}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <img src="/img/logo-white.svg" alt="SKILL CGN" className="h-5 w-auto" width={100} height={20} />
            {kpi.campaigns.length > 1 && (
              <select aria-label="Kampagne" value={kpi.campaign} onChange={e => setParams({ campaign: e.target.value })} className="border border-white/20 bg-[#343C3F] px-2 py-1 font-mono text-xs text-white">
                {kpi.campaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <button type="button" onClick={load} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#B8C0C3] hover:text-white" aria-label="Neu laden">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Neu
            </button>
          </div>
        </header>
        {err && <p className="mt-3 border-l-4 border-[#FF4D4D] pl-3 text-sm font-bold">{err}</p>}

        {/* Drei Kacheln */}
        <section className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className={card}>
            <p className={kicker}>Echte Verträge</p>
            <p className="mt-1 font-mono text-4xl font-bold">{int(t.contracts)}</p>
            <p className="mt-1 break-words font-mono text-[11px] text-[#B8C0C3]">{kpi.contracts.length ? kpi.contracts.map(c => `${c.contractId} (${dm(c.date)})`).join(" · ") : "noch keiner"}</p>
          </div>
          <div className={card}>
            <p className={kicker}>Kosten je Vertrag</p>
            <p className="mt-1 font-mono text-4xl font-bold">{t.cpa == null ? "—" : eur(t.cpa, 0)}</p>
            <span className={`mt-2 inline-block px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${PILL[t.ampel.farbe]}`}>{t.ampel.text}</span>
          </div>
          <div className={card}>
            <p className={kicker}>Ausgaben seit Start</p>
            <p className="mt-1 font-mono text-4xl font-bold">{eur(t.spend, 0)}</p>
            <p className="mt-1 font-mono text-[11px] text-[#B8C0C3]"><span className="text-[#FBFF00]">■</span> Meta {eur(t.spend_meta, 0)} · <span className="text-[#6FA8FF]">■</span> Google {eur(t.spend_google, 0)}</p>
          </div>
        </section>
        {noAds && <p className="mt-3 border-l-4 border-[#FBFF00] bg-[#343C3F] px-3 py-2 text-sm">Noch keine Werbezahlen. Claude schickt sie beim nächsten Check, oder trag sie unten ein. Verträge und Trichter kommen schon aus euren eigenen Daten.</p>}

        {/* Trichter */}
        <section className={`${card} mt-2`}>
          <p className={kicker}>Trichter seit Start</p>
          <div className="mt-3 space-y-2">
            {([["Klicks (echt)", f.clicks], ["Formular gestartet", f.starts], ["Bis zur Zahlung", f.payment], ["Verträge", f.contracts]] as [string, number][]).map(([label, n], i, all) => {
              const max = Math.max(1, ...all.map(x => x[1]));
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2 text-sm"><span>{label}</span><span className="font-mono font-bold">{int(n)}</span></div>
                  <div className="mt-1 h-3 bg-[#2A3133]"><div className="h-3" style={{ width: `${Math.max(n ? 2 : 0, (n / max) * 100)}%`, background: i === 3 ? C.gruen : C.gelb }} /></div>
                </div>
              );
            })}
          </div>
          {f.clicks > 0 && <p className="mt-3 font-mono text-[11px] text-[#B8C0C3]">{pct(Math.round((f.starts / f.clicks) * 1000) / 10)} der Klicks starten das Formular · {f.starts ? pct(Math.round((f.contracts / f.starts) * 1000) / 10) : "—"} der Formulare werden Vertrag</p>}
        </section>

        {/* Ausgaben je Tag */}
        <section className={`${card} mt-2`}>
          <p className={kicker}>Ausgaben je Tag</p>
          <DayBars days={kpi.days} />
          <p className="mt-2 font-mono text-[11px] text-[#B8C0C3]"><span className="text-[#FBFF00]">■</span> Meta · <span className="text-[#6FA8FF]">■</span> Google · <span className="text-[#4DFF88]">●</span> Vertrag · blass = Tag läuft noch</p>
        </section>

        {/* Anzeigen */}
        {kpi.ads.length > 0 && (
          <section className={`${card} mt-2`}>
            <p className={kicker}>Anzeigen (Meta)</p>
            <div className="mt-3 space-y-4">
              {kpi.ads.map(a => (
                <div key={a.id || a.name}>
                  <div className="flex items-baseline justify-between gap-2"><span className="min-w-0 truncate font-bold">{a.name}</span><span className="shrink-0 font-mono text-sm">{eur(a.spend)}</span></div>
                  <div className="mt-1 flex items-center gap-2"><div className="h-2.5 flex-1 bg-[#2A3133]"><div className="h-2.5 bg-[#FBFF00]" style={{ width: `${a.share}%` }} /></div><span className="w-12 text-right font-mono text-[11px] text-[#B8C0C3]">{pct(a.share)}</span></div>
                  <p className="mt-1 font-mono text-[11px] text-[#B8C0C3]">CTR {pct(a.ctr)} · Klick {eur(a.cpc)} · Käufe laut Meta {int(a.purchases_meta)}{a.status ? ` · ${a.status}` : ""}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Google-Suche */}
        {(kpi.google.impressions || kpi.google.clicks || kpi.google.spend) ? (
          <section className={`${card} mt-2`}>
            <p className={kicker}>Google-Suche seit Start</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([["Impressionen", int(kpi.google.impressions)], ["Klicks", int(kpi.google.clicks)], ["CTR", pct(kpi.google.ctr)], ["Klickpreis", eur(kpi.google.cpc)]] as [string, string][]).map(([l, v]) => (
                <div key={l}><p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#B8C0C3]">{l}</p><p className="font-mono text-lg font-bold">{v}</p></div>
              ))}
            </div>
          </section>
        ) : null}

        <Notes campaign={kpi.campaign} next={kpi.next} open={kpi.open} onSaved={load} />
        <AdForm campaign={kpi.campaign} days={kpi.days} onSaved={load} />

        <footer className="mt-6 space-y-1 font-mono text-[11px] text-[#B8C0C3]">
          <p>Käufe laut Meta sind keine Verträge, echte Verträge kommen aus Magicline (gezählt über die Website, wie im Tagesbericht).</p>
          {kpi.tests_hidden > 0 && <p>{kpi.tests_hidden} Testeinträge ausgeblendet.</p>}
          <p><a href="/skilltool2/logout" className="underline hover:text-white">Abmelden</a></p>
        </footer>
      </div>
    </main>
  );
}

/* Gestapelte Balken je Tag: Meta unten (gelb), Google oben (blau), Teiltag blass, Vertrag als grüne Marke. Ohne Bibliothek. */
function DayBars({ days }: { days: Day[] }) {
  if (!days.length) return <p className="mt-3 text-sm text-[#B8C0C3]">Noch keine Tage.</p>;
  const max = Math.max(1, ...days.map(d => (d.meta || 0) + (d.google || 0)));
  return (
    <div className="mt-3 flex items-end gap-1" role="img" aria-label="Ausgaben je Tag">
      {days.map((d, i) => {
        const meta = d.meta || 0, google = d.google || 0, total = meta + google;
        /* Datum kurz: nur der Tag, beim ersten Balken und bei Monatswechsel mit Monat (passt bei 12 Tagen auf 390 px) */
        const label = i === 0 || days[i - 1].date.slice(5, 7) !== d.date.slice(5, 7) ? dm(d.date) : `${d.date.slice(8, 10)}.`;
        return (
          <div key={d.date} className={`flex min-w-0 flex-1 flex-col items-center ${d.partial ? "opacity-50" : ""}`}>
            <div className="flex h-4 items-end">{d.contracts > 0 && <span className="font-mono text-[10px] font-bold text-[#4DFF88]" title={`${d.contracts} Vertrag`}>●{d.contracts > 1 ? d.contracts : ""}</span>}</div>
            <div className="flex h-28 w-full flex-col justify-end">
              <div style={{ height: `${(google / max) * 100}%`, background: C.blau }} />
              <div style={{ height: `${(meta / max) * 100}%`, background: C.gelb }} />
            </div>
            <span className="mt-1 font-mono text-[9px] leading-tight">{total ? Math.round(total) : ""}</span>
            <span className="whitespace-nowrap font-mono text-[9px] leading-tight text-[#B8C0C3]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* Nächste Entscheidung und Offene Punkte, über den Stift bearbeitbar (POST /api/skilltool2/notes) */
function Notes({ campaign, next, open, onSaved }: { campaign: string; next: string; open: string[]; onSaved: () => void }) {
  const [edit, setEdit] = useState(false), [n, setN] = useState(next), [o, setO] = useState(open.join("\n")), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { if (!edit) { setN(next); setO(open.join("\n")); } }, [next, open, edit]);
  const save = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/skilltool2/notes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ campaign, next: n, open: o.split("\n").map(x => x.trim()).filter(Boolean) }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setEdit(false); onSaved(); } else setErr("Speichern ging nicht. Noch einmal.");
  };
  return (
    <section className={`${card} mt-2`}>
      <div className="flex items-center justify-between"><p className={kicker}>Nächste Entscheidung</p>
        {!edit && <button type="button" onClick={() => setEdit(true)} aria-label="Bearbeiten" className="p-1 text-[#B8C0C3] hover:text-white"><Pencil className="h-4 w-4" /></button>}</div>
      {edit ? (
        <div className="mt-2 space-y-3">
          <textarea aria-label="Nächste Entscheidung" value={n} onChange={e => setN(e.target.value)} rows={3} className={field + " py-2 font-sans"} />
          <label className="block"><span className={kicker}>Offene Punkte, einer je Zeile</span><textarea value={o} onChange={e => setO(e.target.value)} rows={5} className={field + " py-2 font-sans"} /></label>
          {err && <p className="border-l-4 border-[#FF4D4D] pl-3 text-sm font-bold">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="min-h-11 bg-[#FBFF00] px-5 text-sm font-bold uppercase tracking-[0.12em] text-black disabled:opacity-50">Speichern</button>
            <button type="button" onClick={() => setEdit(false)} className="min-h-11 border border-white/30 px-5 text-sm font-bold uppercase tracking-[0.12em]">Abbrechen</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-base">{next || <span className="text-[#B8C0C3]">Noch nichts eingetragen.</span>}</p>
          <p className={`${kicker} mt-4`}>Offene Punkte</p>
          {open.length ? <ul className="mt-2 space-y-1">{open.map(x => <li key={x} className="flex gap-2 text-sm"><span className="text-[#FBFF00]">■</span><span>{x}</span></li>)}</ul> : <p className="mt-2 text-sm text-[#B8C0C3]">Keine.</p>}
        </>
      )}
    </section>
  );
}

/* Werbezahlen eines Tages von Hand (POST /api/skilltool2/ads). Vorbefüllt mit dem, was für den Tag schon da ist; gespeichert werden nur
   die Felder dieses Formulars (mergeDays), der Rest des Tages bleibt (Prüfung 21.11.2026). */
const NUM_FIELDS = ["meta", "google", "link_clicks", "junk_clicks", "lpv", "purchases_meta"] as const;
type FormVals = { date: string; partial: boolean } & Record<typeof NUM_FIELDS[number], string>;
const fromDay = (date: string, days: Day[]): FormVals => {
  const d = days.find(x => x.date === date) as (Day & Record<string, unknown>) | undefined;
  const v = Object.fromEntries(NUM_FIELDS.map(k => [k, d && typeof d[k] === "number" ? String(d[k]).replace(".", ",") : ""])) as Record<typeof NUM_FIELDS[number], string>;
  return { date, partial: !!d?.partial && !!(d.meta || d.google), ...v };
};
function AdForm({ campaign, days, onSaved }: { campaign: string; days: Day[]; onSaved: () => void }) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const [v, setV] = useState<FormVals>(() => fromDay(today, days));
  const set = (k: keyof FormVals) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setMsg("");
    if (k === "date") setV(fromDay(String(val), days)); else setV(x => ({ ...x, [k]: val }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const day: Record<string, unknown> = { date: v.date, partial: v.partial };
    for (const k of NUM_FIELDS) if (v[k] !== "") day[k] = v[k];
    const r = await fetch("/api/skilltool2/ads", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ campaign, mergeDays: true, days: [day] }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setMsg("Gespeichert."); onSaved(); } else setMsg("Speichern ging nicht. Noch einmal.");
  };
  const inp = (k: typeof NUM_FIELDS[number], label: string, mode: "decimal" | "numeric" = "decimal") => (
    <label className="block min-w-0"><span className={kicker}>{label}</span><input inputMode={mode} value={v[k] as string} onChange={set(k)} className={field} /></label>
  );
  return (
    <section className={`${card} mt-2`}>
      <button type="button" onClick={() => { if (!show) setV(fromDay(v.date, days)); setMsg(""); setShow(!show); }} className="flex w-full items-center justify-between text-left"><span className={kicker}>Zahlen eines Tages eintragen oder korrigieren</span><span className="font-mono text-sm">{show ? "−" : "+"}</span></button>
      {show && (
        <form onSubmit={save} className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 block"><span className={kicker}>Tag</span><input type="date" value={v.date} onChange={set("date")} className={field} required /></label>
          {inp("meta", "Meta €")}{inp("google", "Google €")}{inp("link_clicks", "Link-Klicks", "numeric")}{inp("junk_clicks", "Davon Fehlklicks", "numeric")}{inp("lpv", "Seitenaufrufe", "numeric")}{inp("purchases_meta", "Käufe laut Meta", "numeric")}
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={v.partial} onChange={set("partial")} className="h-4 w-4 accent-[#FBFF00]" /> Tag läuft noch</label>
          <div className="col-span-2 flex items-center gap-3">
            <button type="submit" disabled={busy} className="min-h-11 bg-[#FBFF00] px-5 text-sm font-bold uppercase tracking-[0.12em] text-black disabled:opacity-50">Speichern</button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
