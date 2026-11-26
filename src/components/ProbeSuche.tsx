/* /vor-ort, Team-Modus: Interessenten (etwa nach dem Probetraining) in Magicline suchen und ihre Daten in den Abschluss übernehmen
   (Boris 26.11.2026). Erst das Team-Passwort, einmal am Tag je iPad, dann Name, E-Mail oder Handy. Die Liste zeigt nur Name, Ort, Datum
   und gekürzte Kontaktdaten. Die vollen Daten holt erst das Antippen, sie gehen direkt ins Formular des Kunden. Server: netlify/functions/vor-ort.mts.
   Ist die Suche nicht eingerichtet (kein Team-Passwort in Netlify), erscheint hier nichts und /vor-ort läuft wie bisher. */
import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, Search, UserCheck, X } from "lucide-react";

export interface Prefill { uuid: string; customerNumber: string; firstName: string; lastName: string; email: string; phone: string; birthDate: string; street: string; streetNumber: string; zipCode: string; city: string }
interface Hit { id: number; name: string; ort: string; seit: string; email: string; tel: string; mitglied: boolean; geburtsdatum: boolean; adresse: boolean }
type Status = { ready: boolean; search: boolean; session: boolean };

const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";
const post = (path: string, body: unknown) => fetch(`/api/vor-ort/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body) });
const msgOf = async (r: Response | null, fallback: string) => { const j = r ? await r.json().catch(() => ({})) : {}; return typeof j.error === "string" && j.error ? j.error : fallback; };
/* Suchen erst ab 3 Buchstaben, einer E-Mail oder 6 Ziffern (wie der Server) */
const searchable = (q: string) => q.includes("@") ? /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(q.trim()) : q.replace(/\D/g, "").length >= 6 || q.replace(/[^\p{L}]/gu, "").length >= 3;
/** Was der Kunde am iPad noch eintippt */
export const missingText = (p: Prefill) => {
  const miss = [!p.birthDate && "Geburtsdatum", !(p.street && p.streetNumber && p.zipCode && p.city) && "Adresse"].filter(Boolean) as string[];
  return miss.length ? `${miss.join(" und ")} tippt der Kunde selbst.` : "Der Kunde gibt nur noch IBAN und Unterschrift ein.";
};

export default function ProbeSuche({ value, onChange }: { value: Prefill | null; onChange: (p: Prefill | null) => void }) {
  const [st, setSt] = useState<Status | null>(null), [pw, setPw] = useState(""), [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null), [more, setMore] = useState(false), [partial, setPartial] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [picking, setPicking] = useState<number | null>(null);
  const seq = useRef(0), timer = useRef(0);
  /* Nach der Übergabe an den Kunden ist diese Ansicht weg: eine Antwort, die erst dann kommt, darf nichts mehr übernehmen (Prüfung 26.11.2026) */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    fetch("/api/vor-ort/status", { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(s => { if (alive.current) setSt(s && typeof s.ready === "boolean" ? s : null); }).catch(() => {});
    return () => { alive.current = false; seq.current++; window.clearTimeout(timer.current); };
  }, []);
  const loggedOut = () => { setSt(s => (s ? { ...s, session: false } : s)); setHits(null); setErr("Bitte Team-Passwort eingeben."); };

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pw || busy) return;
    setBusy(true); setErr("");
    const r = await post("login", { password: pw }).catch(() => null);
    setBusy(false); setPw("");
    if (r?.ok) { setSt(s => (s ? { ...s, session: true } : s)); return; }
    setErr(await msgOf(r, r ? "Passwort stimmt nicht." : "Keine Verbindung. Bitte noch einmal."));
  };
  /* Suchen: kurz nach dem Tippen oder sofort mit Enter. Ältere Antworten werden verworfen. */
  const search = async (term: string) => {
    window.clearTimeout(timer.current);
    if (!searchable(term)) { seq.current++; setBusy(false); setHits(null); setMore(false); setPartial(false); return; }
    const my = ++seq.current;
    setBusy(true); setErr("");
    const r = await post("suche", { q: term }).catch(() => null);
    if (my !== seq.current || !alive.current) return;
    setBusy(false);
    if (r?.status === 401) { loggedOut(); return; }
    if (!r?.ok) { setHits(null); setErr(await msgOf(r, r ? "Suche ging nicht. Bitte noch einmal." : "Keine Verbindung. Bitte noch einmal.")); return; }
    const j = await r.json().catch(() => ({})) as { hits?: Hit[]; more?: boolean; partial?: boolean };
    if (my !== seq.current || !alive.current) return;
    setHits(Array.isArray(j.hits) ? j.hits : []); setMore(!!j.more); setPartial(!!j.partial);
  };
  const onType = (v: string) => { setQ(v); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => search(v), 450); };
  const pick = async (h: Hit) => {
    if (h.mitglied || picking) return;
    setPicking(h.id); setErr("");
    const r = await post("kunde", { id: h.id }).catch(() => null);
    if (!alive.current) return;
    setPicking(null);
    if (r?.status === 401) { loggedOut(); return; }
    if (!r?.ok) { setErr(await msgOf(r, r ? "Daten nicht abrufbar. Bitte noch einmal." : "Keine Verbindung. Bitte noch einmal.")); return; }
    const j = await r.json().catch(() => ({})) as { kunde?: Prefill };
    if (!alive.current) return;
    if (!j.kunde) { setErr("Daten nicht abrufbar. Bitte noch einmal."); return; }
    onChange(j.kunde); setHits(null); setQ("");
  };

  if (!st?.ready) return null;
  return (
    <section className="mb-8 border border-white/15 bg-[#1a2224] p-5" aria-label="Interessent aus Magicline">
      <p className={kicker}>Schon beim Probetraining? Daten übernehmen</p>
      {!st.search ? (
        <p className="mt-2 text-sm text-white/55">Suche noch nicht eingerichtet: in Netlify fehlt der Magicline-Schlüssel.</p>
      ) : value ? (
        <div className="mt-3 flex items-start justify-between gap-4 border-2 border-[#FBFF00] bg-[#2A3133] p-4">
          <div className="flex min-w-0 items-start gap-3"><UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#FBFF00]" />
            <div className="min-w-0"><p className="font-bold">{value.firstName} {value.lastName} übernommen</p><p className="mt-1 text-sm text-white/65">{missingText(value)}</p></div></div>
          <button type="button" onClick={() => onChange(null)} className="campaign-mono inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /> Andere Person</button>
        </div>
      ) : !st.session ? (
        <form onSubmit={login} className="mt-3 flex flex-wrap items-center gap-3">
          <Lock className="h-4 w-4 text-white/50" />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Team-Passwort" autoComplete="current-password" aria-label="Team-Passwort" className="campaign-field !w-64 !py-2 text-base" />
          <button type="submit" disabled={busy || !pw} className="campaign-button inline-flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 text-sm font-bold uppercase tracking-[0.12em] text-black disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Entsperren</button>
          <span className="text-xs text-white/45">Einmal am Tag je iPad.</span>
        </form>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-white/50" />
            <input type="search" value={q} onChange={e => onType(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search(q); } }} placeholder="Name, E-Mail oder Handy" aria-label="Interessent suchen" autoComplete="off" spellCheck={false} className="campaign-field !py-2 text-base" />
            {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#FBFF00]" aria-label="Sucht" />}
          </div>
          {hits && (hits.length ? (
            <ul className="mt-3 grid gap-px bg-white/15">
              {hits.map(h => (
                <li key={h.id}>
                  <button type="button" onClick={() => pick(h)} disabled={h.mitglied || picking !== null} className={`campaign-button flex w-full items-center justify-between gap-3 p-3 text-left ${h.mitglied ? "cursor-not-allowed bg-[#2A3133] text-white/45" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{h.name}{h.ort ? <span className="font-normal text-white/60"> · {h.ort}</span> : null}</span>
                      <span className="block truncate text-xs text-white/55">{[h.seit && `seit ${h.seit}`, h.email, h.tel && `Handy ${h.tel}`].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="campaign-mono shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#FBFF00]">{picking === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : h.mitglied ? <span className="text-white/45">Schon Mitglied</span> : "Übernehmen"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-white/55">Niemand gefunden. Dann tippt der Kunde seine Daten selbst ein.</p>)}
          {more && <p className="mt-2 text-xs text-white/45">Mehr als 10 Treffer, bitte genauer suchen (Vor- und Nachname).</p>}
          {partial && <p className="mt-2 text-xs text-white/60">Magicline hat nicht auf alles geantwortet. Fehlt die Person, Enter drücken und noch einmal suchen.</p>}
        </div>
      )}
      {err && <p role="alert" className="mt-3 border-l-4 border-[#FBFF00] pl-3 text-sm font-bold">{err}</p>}
    </section>
  );
}
