/*
 * Onboarding-Termin direkt buchen (Dankeseite nach dem Kauf und /onboarding aus der Mail). Freie Zeiten kommen live aus den Google-Kalendern
 * (/api/onboarding/slots, Regel in netlify/functions/lib/onboarding.ts), gebucht wird mit einem Tipp (/api/onboarding/book).
 * Immer aktuell: Liste lädt jede Minute neu und sofort, wenn der Tab wieder sichtbar wird. Löscht das Team einen Kurs, ist die Lücke gleich buchbar.
 * Token: aus dem Mail-Link (token) oder auf der Dankeseite aus dem gerade abgeschlossenen Vertrag (checkoutToken -> /api/onboarding/token).
 * Ist die Google-Anbindung nicht eingerichtet oder nicht erreichbar, zeigt die Komponente den bisherigen Weg (fallback).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarPlus, Check, Clock, Loader2, MessageCircle } from "lucide-react";
import { WHATSAPP } from "@/lib/magicline";

interface Free { start: string; end: string }
interface Booked extends Free { coach?: string; google?: string; ics?: string }
type Phase = "token" | "loading" | "ready" | "booked" | "past" | "unavailable" | "error";

const TZ = "Europe/Berlin";
const REFRESH_MS = 60000, REFRESH_MAX = 30, REFRESH_GAP_MS = 15000; // höchstens 30 Minuten automatisch, Tab-Rückkehr höchstens alle 15 s
const dayChip = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function OnboardingBooking({ token: givenToken, checkoutToken, contractId, waText, fallback, onBooked, kind = "onboarding", onBookedOk }: { token?: string; checkoutToken?: string; contractId?: string; waText: string; fallback: ReactNode; onBooked?: (booked: boolean) => void; kind?: "onboarding" | "probetraining"; onBookedOk?: (b: Booked) => void }) {
  const label = kind === "probetraining" ? "Probetraining" : "Onboarding";
  const [t, setT] = useState(givenToken || "");
  const [phase, setPhase] = useState<Phase>(givenToken ? "loading" : "token");
  const [byDay, setByDay] = useState<Record<string, Free[]>>({});
  const [minutes, setMinutes] = useState(kind === "probetraining" ? 30 : 90);
  const [day, setDay] = useState("");
  const [pick, setPick] = useState<Free | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const pickRef = useRef<Free | null>(null); pickRef.current = pick;
  const busyRef = useRef(false); busyRef.current = busy;
  const lastLoad = useRef(0), autoCount = useRef(0);
  const wa = `${WHATSAPP}?text=${encodeURIComponent(waText)}`;

  /* 1. Token für diesen Käufer holen (Dankeseite). 202 = Abschluss wird gerade noch gespeichert, kurz warten. */
  useEffect(() => {
    if (givenToken) { setT(givenToken); setPhase("loading"); return; }
    /* Kein Token: kurz warten, die Dankeseite liest den Abschluss erst nach dem ersten Rendern aus sessionStorage */
    if (!checkoutToken) { const id = window.setTimeout(() => setPhase("unavailable"), 400); return () => window.clearTimeout(id); }
    setPhase("token");
    let stop = false;
    (async () => {
      for (let i = 0; i < 20 && !stop; i++) {
        try {
          const r = await fetch("/api/onboarding/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: checkoutToken, contractId }) });
          if (r.status === 202) { await sleep(1500); continue; }
          const j = await r.json().catch(() => ({}));
          if (stop) return;
          if (r.ok && j.available && j.t) { setT(j.t); setPhase("loading"); return; }
          setPhase("unavailable"); return;
        } catch { await sleep(1500); }
      }
      if (!stop) setPhase("unavailable");
    })();
    return () => { stop = true; };
  }, [givenToken, checkoutToken, contractId]);

  /* 2. Freie Zeiten laden. silent = Aktualisierung im Hintergrund: Fehler lassen die bisherige Liste stehen. */
  const load = useCallback(async (silent = false) => {
    if (!t) return;
    lastLoad.current = Date.now();
    try {
      const r = await fetch(`/api/termin/slots?t=${encodeURIComponent(t)}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      /* 503/401: keine Anbindung oder Link ungültig. 5xx: Google antwortet gerade nicht. Dann den Rückfall zeigen (Wunschtermin-Kalender, Boris
         19.11.2026: nicht WhatsApp). Im Hintergrund bleibt die bisherige Liste stehen. */
      if (r.status === 503 || r.status === 401 || r.status >= 500) { if (!silent) setPhase("unavailable"); return; }
      if (!r.ok || j.error) { if (!silent) { setNote(j.error || "Kalender gerade nicht erreichbar."); setPhase("error"); } return; }
      if (j.booked) { setBooked(j.booked); setPhase("booked"); return; }
      if (j.past) { setBooked(j.past); setPhase("past"); return; }
      const next: Record<string, Free[]> = j.byDay || {};
      const days = Object.keys(next).sort();
      setByDay(next); if (j.durationMin) setMinutes(j.durationMin);
      setDay(cur => (cur && next[cur] ? cur : days[0] || ""));
      const p = pickRef.current;
      if (p && !Object.values(next).some(list => list.some(f => f.start === p.start))) { setPick(null); setNote("Deine gewählte Zeit ist inzwischen vergeben. Bitte wähle eine andere."); }
      setPhase("ready");
    } catch { if (!silent) setPhase("unavailable"); }
  }, [t]);
  useEffect(() => { if (phase === "loading") load(); }, [phase, load]);

  /* 3. Live halten: jede Minute und beim Zurückkehren in den Tab neu laden (nicht während einer Buchung) */
  useEffect(() => {
    if (phase !== "ready") return;
    const visible = () => document.visibilityState === "visible" && !busyRef.current;
    const tick = () => { if (visible() && autoCount.current < REFRESH_MAX) { autoCount.current++; load(true); } };
    const back = () => { if (visible() && Date.now() - lastLoad.current > REFRESH_GAP_MS) { autoCount.current = 0; load(true); } };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [phase, load]);

  /* Überschrift der Seite: nach der Buchung "Dein Onboarding-Termin" statt "Buch deinen …" */
  useEffect(() => { onBooked?.(phase === "booked" || phase === "past"); }, [phase, onBooked]);

  const days = useMemo(() => Object.keys(byDay).sort(), [byDay]);
  const free = byDay[day] || [];

  /* 4. Buchen. 409 = Zeit gerade weg: Liste neu laden. */
  const book = async () => {
    if (!pick || busy) return;
    setBusy(true); setNote(null);
    try {
      const r = await fetch("/api/termin/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, start: pick.start }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { const b = { start: j.start, end: j.end, coach: j.coach, google: j.google, ics: j.ics }; setBooked(b); setPhase("booked"); onBookedOk?.(b); }
      else if (j.booked) { setBooked(j.booked); setPhase("booked"); }
      else if (j.past) { setBooked(j.past); setPhase("past"); }
      else { setNote(j.error || "Das hat nicht geklappt. Bitte wähle noch einmal."); setPick(null); load(true); }
    } catch { setNote("Verbindung fehlgeschlagen. Bitte noch einmal tippen."); }
    finally { setBusy(false); }
  };

  if (phase === "unavailable") return <>{fallback}</>;

  if (phase === "booked" && booked) return (
    <div className="mt-6 border-2 border-[#FBFF00] bg-[#1a2224] p-5" role="status">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-5 w-5 text-black" strokeWidth={3} /></span><p className="campaign-display text-3xl uppercase leading-none">Termin steht.</p></div>
      <p className="campaign-mono mt-4 text-lg text-[#FBFF00]">{longDay(booked.start)}<br />{timeOf(booked.start)} bis {timeOf(booked.end)} Uhr</p>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{booked.coach ? `Mit ${booked.coach}, ` : ""}Herzogstraße 16–20, zwei Minuten vom Neumarkt. Die Bestätigung kommt per Mail.</p>
      {(booked.google || booked.ics) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {booked.google && <a href={booked.google} target="_blank" rel="noopener noreferrer" className="campaign-button flex min-h-12 items-center justify-center gap-2 border-2 border-white/30 px-3 text-[11px] font-bold uppercase tracking-[0.12em] hover:border-[#FBFF00]"><CalendarPlus className="h-4 w-4 shrink-0" /> Google</a>}
          {booked.ics && <a href={booked.ics} className="campaign-button flex min-h-12 items-center justify-center gap-2 border-2 border-white/30 px-3 text-[11px] font-bold uppercase tracking-[0.12em] hover:border-[#FBFF00]"><CalendarPlus className="h-4 w-4 shrink-0" /> Apple / Outlook</a>}
        </div>
      )}
      <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 text-sm text-white/70 underline underline-offset-4 hover:text-[#FBFF00]"><MessageCircle className="h-4 w-4" /> Termin verschieben? Schreib Boris</a>
    </div>
  );

  if (phase === "past" && booked) return (
    <div className="mt-6 border-2 border-white/15 p-5 text-sm leading-relaxed text-white/80">
      Dein {label} war am {longDay(booked.start)} um {timeOf(booked.start)} Uhr. Für einen neuen Termin schreib Boris kurz.
      <a href={wa} target="_blank" rel="noopener noreferrer" className="campaign-button mt-4 flex min-h-12 items-center justify-center gap-2 bg-[#FBFF00] px-4 text-xs font-bold uppercase tracking-[0.12em] text-black"><MessageCircle className="h-4 w-4" /> WhatsApp an Boris</a>
    </div>
  );

  if (phase === "token" || phase === "loading") return (
    <div className="mt-6 flex items-center gap-3 border-2 border-white/15 p-5 text-sm text-white/70" role="status"><Loader2 className="h-5 w-5 animate-spin text-[#FBFF00]" /> Freie Termine werden geladen …</div>
  );

  if (phase === "error") return (
    <div className="mt-6 border-2 border-[#FBFF00] bg-[#1a2224] p-5 text-sm text-white/80" role="alert">
      <p>{note}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => { setNote(null); setPhase("loading"); }} className="campaign-button min-h-11 border-2 border-white/30 px-4 text-xs font-bold uppercase tracking-[0.12em] hover:border-[#FBFF00]">Noch einmal laden</button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="campaign-button inline-flex min-h-11 items-center gap-2 bg-[#FBFF00] px-4 text-xs font-bold uppercase tracking-[0.12em] text-black"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
      </div>
    </div>
  );

  return (
    <div className="mt-6">
      <p className="campaign-mono text-[10px] uppercase tracking-[0.2em] text-white/50">{minutes} Minuten · Uhrzeiten in Köln · live aus unserem Kalender</p>
      {note && <p role="alert" className="mt-3 border-l-4 border-[#FBFF00] bg-[#FBFF00]/10 px-3 py-2 text-sm font-bold text-[#FBFF00]">{note}</p>}
      {days.length === 0 ? (
        <div className="mt-3 border-2 border-white/15 p-5 text-sm leading-relaxed text-white/75">
          In den nächsten drei Wochen ist online gerade nichts frei. Schreib Boris, ihr findet einen Termin.
          <a href={wa} target="_blank" rel="noopener noreferrer" className="campaign-button mt-4 flex min-h-12 items-center justify-center gap-2 bg-[#FBFF00] px-4 text-xs font-bold uppercase tracking-[0.12em] text-black"><MessageCircle className="h-4 w-4" /> Termin per WhatsApp</a>
        </div>
      ) : (
        <>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2" role="tablist" aria-label="Tag wählen">
            {days.map(d => (
              <button key={d} type="button" role="tab" aria-selected={day === d} onClick={() => { setDay(d); setPick(null); setNote(null); }}
                className={`campaign-mono shrink-0 border-2 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.1em] ${day === d ? "border-[#FBFF00] bg-[#FBFF00] text-black" : "border-white/20 text-white/75 hover:border-[#FBFF00]/60"}`}>{dayChip(d)}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={`Uhrzeit am ${day ? dayChip(day) : ""} wählen`}>
            {free.map(f => (
              <button key={f.start} type="button" role="radio" aria-checked={pick?.start === f.start} onClick={() => { setPick(f); setNote(null); }}
                className={`campaign-mono min-h-12 border-2 text-base font-bold ${pick?.start === f.start ? "border-[#FBFF00] bg-[#FBFF00] text-black" : "border-white/20 text-white hover:border-[#FBFF00]"}`}>{timeOf(f.start)}</button>
            ))}
          </div>
          <button type="button" onClick={book} disabled={!pick || busy}
            className={`campaign-button mt-4 flex min-h-14 w-full items-center justify-center gap-2 px-4 text-sm font-bold uppercase tracking-[0.1em] ${pick && !busy ? "bg-[#FBFF00] text-black hover:bg-white" : "cursor-not-allowed bg-white/10 text-white/40"}`}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird eingetragen …</> : pick ? <>{dayChip(day)}, {timeOf(pick.start)} Uhr buchen <ArrowRight className="h-4 w-4 shrink-0" /></> : <><Clock className="h-4 w-4" /> Uhrzeit wählen</>}
          </button>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70 underline underline-offset-4 hover:text-[#FBFF00]"><MessageCircle className="h-4 w-4" /> Keine passende Zeit? Schreib Boris</a>
        </>
      )}
    </div>
  );
}
