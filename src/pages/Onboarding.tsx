/*
 * SKILL CGN — Onboarding-Termin wählen (90 Min: Scan, Einweisung, Trainingsplan). Erreichbar nur über den persönlichen Link aus der
 * Abschlussmail (/onboarding?t=…). Freie Zeiten von /api/onboarding/slots, Buchung über /api/onboarding/book. Optik wie Kursplan.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock, Loader2, MessageCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { WHATSAPP } from "@/lib/magicline";

interface Free { start: string; end: string }
type Slots = { firstName: string; durationMin?: number; byDay?: Record<string, Free[]>; booked?: Free; error?: string };

const TZ = "Europe/Berlin";
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const badge = "inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 mb-5";

export default function Onboarding() {
  usePageMeta("Onboarding-Termin wählen — SKILL CGN", "Such dir deinen Termin für Scan, Einweisung und Trainingsplan aus.", "noindex,nofollow");
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [data, setData] = useState<Slots | null>(null);
  const [day, setDay] = useState("");
  const [pick, setPick] = useState<Free | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Free | null>(null);

  const load = () => {
    if (!token) { setError("Dieser Link ist unvollständig. Öffne ihn bitte direkt aus deiner E-Mail."); return; }
    fetch(`/api/onboarding/slots?t=${encodeURIComponent(token)}`).then(r => r.json()).then((d: Slots) => {
      if (d.error) throw new Error(d.error);
      setData(d); if (d.booked) setDone(d.booked);
      const days = Object.keys(d.byDay || {}).sort(); setDay(cur => cur && d.byDay?.[cur] ? cur : days[0] || "");
    }).catch(e => setError(String(e.message || e)));
  };
  useEffect(load, [token]);

  const days = useMemo(() => Object.keys(data?.byDay || {}).sort(), [data]);
  const free = data?.byDay?.[day] || [];

  const book = async () => {
    if (!pick) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/onboarding/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, start: pick.start }) });
      const j = await r.json();
      if (j.ok) setDone({ start: j.start, end: j.end });
      else if (j.booked) setDone(j.booked);
      else { setError(j.error || "Das hat nicht geklappt. Bitte noch einmal versuchen."); setPick(null); load(); }
    } catch { setError("Verbindung fehlgeschlagen. Bitte noch einmal versuchen."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden py-16 md:py-20 border-b-4 border-primary">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, #fbff00 40px, #fbff00 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #fbff00 40px, #fbff00 41px)" }} />
        <div className="container relative">
          <div className="max-w-3xl">
            <div className={badge}><CalendarDays className="w-3.5 h-3.5 inline mr-2" />Onboarding</div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-none mb-4">{data?.firstName ? <>{data.firstName},<br /></> : null}<span className="text-primary">such dir deinen Start aus.</span></h1>
            <p className="text-lg text-foreground/60 max-w-xl">90 Minuten mit deinem Coach: 3D-Scan, Einweisung an den Geräten, dein Trainingsplan.</p>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container max-w-5xl">
          {done ? (
            <div className="border-2 border-primary bg-card p-6 md:p-8 max-w-xl">
              <div className="w-14 h-14 bg-primary flex items-center justify-center mb-5"><Check className="w-7 h-7 text-primary-foreground" /></div>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Termin steht.</h2>
              <p className="font-mono text-xl text-primary mb-4">{longDay(done.start)}, {timeOf(done.start)} bis {timeOf(done.end)} Uhr</p>
              <p className="text-sm text-foreground/60">Die Bestätigung kommt per E-Mail. Herzogstraße 16–20, zwei Minuten vom Neumarkt. Bring Sportsachen, saubere Hallenschuhe und ein Handtuch mit.</p>
            </div>
          ) : (
            <>
              {error && <div className="border-2 border-primary bg-card p-6 text-sm mb-8">{error} <a href={WHATSAPP} className="text-primary underline">WhatsApp</a></div>}
              {!data && !error && <div className="flex items-center gap-3 text-foreground/50 text-sm"><Loader2 className="w-5 h-5 animate-spin text-primary" /> Freie Termine werden geladen …</div>}
              {data && days.length === 0 && <p className="text-foreground/60 text-sm">In den nächsten drei Wochen ist gerade nichts frei. Schreib uns per <a href={WHATSAPP} className="text-primary underline">WhatsApp</a>, wir finden einen Termin.</p>}
              {data && days.length > 0 && (
                <>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 mb-8" role="tablist">
                    {days.map(d => (
                      <button key={d} role="tab" aria-selected={day === d} onClick={() => { setDay(d); setPick(null); }} className={`flex-shrink-0 px-4 py-3 font-black uppercase tracking-widest text-xs border-2 transition-colors ${day === d ? "bg-primary border-primary text-primary-foreground" : "border-foreground/15 text-foreground/60 hover:border-primary/60"}`}>{dayLabel(d)}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-px bg-foreground/10 mb-8">
                    {free.map(f => (
                      <button key={f.start} type="button" onClick={() => setPick(f)} aria-pressed={pick?.start === f.start} className={`p-4 font-mono text-lg font-bold transition-colors ${pick?.start === f.start ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:text-primary"}`}>{timeOf(f.start)}</button>
                    ))}
                  </div>
                  <div className="sticky bottom-4 z-20">
                    <button type="button" onClick={book} disabled={!pick || busy}
                      className={`w-full flex items-center justify-center gap-3 font-black uppercase tracking-widest text-sm py-5 transition-all duration-200 ${pick && !busy ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl" : "bg-foreground/10 text-foreground/30 cursor-not-allowed"}`}>
                      {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Wird eingetragen …</> : pick ? <>{longDay(pick.start)}, {timeOf(pick.start)} Uhr buchen <ArrowRight className="w-5 h-5" /></> : <>Uhrzeit wählen <Clock className="w-5 h-5" /></>}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          <p className="text-xs text-foreground/40 mt-8 inline-flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5 text-primary" /> Keine passende Zeit dabei? Schreib uns per <a href={WHATSAPP} className="text-primary underline">WhatsApp</a>.</p>
        </div>
      </section>
    </div>
  );
}
