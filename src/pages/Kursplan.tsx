/*
 * SKILL CGN — Kursplan mit Buchung ohne Login (Phase 1). Daten von /api/schedule (Netlify Function),
 * Buchung über /api/book. Optik wie Classes/Shop (Manus-Tokens). Im Testmodus (mode = "mock") Hinweisbanner.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, Loader2, MessageCircle, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { track } from "@/lib/pixel";
import { WHATSAPP } from "@/lib/magicline";

interface Slot { id: string; name: string; description?: string; start: string; end: string; trainer: string; max: number; booked: number; free: number; bookable: boolean; source: "magicline" | "mock" }
interface Schedule { mode: "live" | "mock"; from: string; byDay: Record<string, Slot[]> }
type BookResult = { ok: true; status: "confirmed" | "pending"; bookingId: string; cancelUrl: string; entitlement: string; creditsLeft?: number } | { error: string };

const TZ = "Europe/Berlin";
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const badge = "inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 mb-5";
const input = "w-full bg-card border-2 border-foreground/10 px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-primary focus:outline-none transition-colors";

export default function Kursplan() {
  usePageMeta("Kursplan & Buchung — SKILL CGN Köln", "Alle Classes der nächsten sieben Tage. Platz sichern mit E-Mail und Handynummer, ohne Login.", "noindex,nofollow");
  const [data, setData] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", privacy: false, website: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BookResult | null>(null);

  const load = () => fetch("/api/schedule?days=7").then(r => r.json()).then((d: Schedule) => { if ((d as any).error) throw new Error((d as any).error); setData(d); setDay(cur => cur && d.byDay[cur] ? cur : Object.keys(d.byDay)[0] || d.from); }).catch(e => setError(String(e.message || e)));
  useEffect(() => { load(); track("ViewContent", { content_name: "Kursplan" }); }, []);

  const days = useMemo(() => data ? Object.keys(data.byDay).sort() : [], [data]);
  const slots = data && day ? data.byDay[day] || [] : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!slot) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slotId: slot.id }) });
      const j: BookResult = await r.json(); setResult(j);
      if ("ok" in j) { track("Schedule", { content_name: slot.name }); load(); }
    } catch { setResult({ error: "Verbindung fehlgeschlagen. Bitte noch einmal versuchen." }); }
    finally { setBusy(false); }
  };
  const close = () => { setSlot(null); setResult(null); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden py-16 md:py-20 border-b-4 border-primary">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, #fbff00 40px, #fbff00 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #fbff00 40px, #fbff00 41px)" }} />
        <div className="container relative">
          <Link to="/classes" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-10 font-black uppercase text-xs tracking-widest"><ArrowLeft className="w-4 h-4" /> Zu den Formaten</Link>
          <div className="max-w-3xl">
            <div className={badge}><CalendarDays className="w-3.5 h-3.5 inline mr-2" />Kursplan</div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-none mb-4">Platz sichern.<br /><span className="text-primary">Ohne Login.</span></h1>
            <p className="text-lg text-foreground/60 max-w-xl">Kurs wählen, Name und Handynummer eintragen, fertig. Mitglieder und Ticketkäufer werden automatisch erkannt.</p>
          </div>
        </div>
      </section>

      {data?.mode === "mock" && (
        <div className="bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest text-center px-4 py-2">Testbetrieb: Der Kursplan zeigt Beispieldaten, bis die Magicline-Anbindung freigeschaltet ist.</div>
      )}

      <section className="py-12 md:py-16">
        <div className="container max-w-5xl">
          {error && <div className="border-2 border-primary bg-card p-6 text-sm">Kursplan gerade nicht erreichbar: {error}. Schreib uns per <a href={WHATSAPP} className="text-primary underline">WhatsApp</a>.</div>}
          {!data && !error && <div className="flex items-center gap-3 text-foreground/50 text-sm"><Loader2 className="w-5 h-5 animate-spin text-primary" /> Kursplan wird geladen …</div>}
          {data && (
            <>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 mb-8" role="tablist">
                {days.map(d => (
                  <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)} className={`flex-shrink-0 px-4 py-3 font-black uppercase tracking-widest text-xs border-2 transition-colors ${day === d ? "bg-primary border-primary text-primary-foreground" : "border-foreground/15 text-foreground/60 hover:border-primary/60"}`}>{dayLabel(d)}</button>
                ))}
              </div>
              {slots.length === 0 && <p className="text-foreground/50 text-sm">An diesem Tag gibt es keine Classes.</p>}
              <ul className="grid gap-px bg-foreground/10">
                {slots.map(s => {
                  const full = s.free <= 0; const past = !s.bookable;
                  return (
                    <li key={s.id} className="bg-card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="font-mono text-2xl font-bold text-primary md:w-32 flex-shrink-0">{timeOf(s.start)}<span className="block text-xs text-foreground/40 font-normal">bis {timeOf(s.end)}</span></div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">{s.name}</h3>
                        <p className="text-xs text-foreground/50 mt-1 flex flex-wrap gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" /> 60 Min</span><span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-primary" /> {full ? "Ausgebucht" : `${s.free} von ${s.max} Plätzen frei`}</span><span>{s.trainer}</span></p>
                      </div>
                      <button type="button" disabled={full || past} onClick={() => { setSlot(s); setResult(null); }} className={`inline-flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs px-6 py-3.5 transition-all ${full || past ? "bg-foreground/10 text-foreground/30 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>{past ? "Vorbei" : full ? "Voll" : <>Buchen <ArrowRight className="w-4 h-4" /></>}</button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="py-14 bg-card border-t border-foreground/10">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-3">Noch kein Ticket?</h2>
          <p className="text-foreground/50 mb-6">Drop In, Trial Pass oder 10er Pass im Shop kaufen. Danach buchst du hier mit derselben E-Mail, dein Guthaben wird automatisch abgezogen.</p>
          <Link to="/shop" className="inline-flex items-center gap-3 border-2 border-primary text-primary font-black uppercase tracking-widest text-sm px-8 py-4 hover:bg-primary hover:text-primary-foreground transition-all">Zum Shop <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      {slot && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 p-0 md:p-6" role="dialog" aria-modal="true" onClick={close}>
          <div className="w-full max-w-lg bg-background border-2 border-primary p-6 md:p-8 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div><p className="text-xs font-black uppercase tracking-widest text-primary mb-1">{dayLabel(day)} · {timeOf(slot.start)} Uhr</p><h3 className="text-2xl font-black uppercase tracking-tight">{slot.name}</h3></div>
              <button type="button" onClick={close} aria-label="Schließen" className="w-9 h-9 border border-foreground/20 flex items-center justify-center hover:border-primary"><X className="w-4 h-4" /></button>
            </div>
            {result && "ok" in result ? (
              <div>
                <div className="w-14 h-14 bg-primary flex items-center justify-center mb-5"><Check className="w-7 h-7 text-primary-foreground" /></div>
                <h4 className="text-xl font-black uppercase tracking-tight mb-2">{result.status === "confirmed" ? "Platz reserviert." : "Anfrage angekommen."}</h4>
                <p className="text-sm text-foreground/60 mb-4">{result.status === "confirmed" ? "Bestätigung kommt per E-Mail. Komm 10 Minuten vorher, Handtuch und Wasser gibt es bei uns." : "Wir konnten dich keinem Vertrag oder Ticket zuordnen. Das Team meldet sich kurz per WhatsApp oder E-Mail."}{typeof result.creditsLeft === "number" ? ` Du hast noch ${result.creditsLeft} Kurse auf deinem Ticket.` : ""}</p>
                <p className="text-xs text-foreground/40">Stornieren bis 4 Stunden vor Beginn über den Link in der E-Mail.</p>
                <button type="button" onClick={close} className="mt-6 w-full bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm py-4">Fertig</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {result && "error" in result && <div className="border-2 border-primary bg-primary/10 text-sm p-4">{result.error}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-black uppercase tracking-widest text-foreground/60 mb-2">Vorname *</label><input required className={input} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" /></div>
                  <div><label className="block text-xs font-black uppercase tracking-widest text-foreground/60 mb-2">Nachname *</label><input required className={input} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" /></div>
                </div>
                <div><label className="block text-xs font-black uppercase tracking-widest text-foreground/60 mb-2">E-Mail *</label><input required type="email" className={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="Die E-Mail deiner Mitgliedschaft oder deines Tickets" /></div>
                <div><label className="block text-xs font-black uppercase tracking-widest text-foreground/60 mb-2">Handynummer *</label><input required type="tel" className={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" placeholder="+49 176 …" /></div>
                <input type="text" name="website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                <label className="flex items-start gap-3 cursor-pointer text-sm text-foreground/70">
                  <input type="checkbox" required checked={form.privacy} onChange={e => setForm({ ...form, privacy: e.target.checked })} className="mt-1 accent-[#fbff00]" />
                  <span>Ich habe die <Link to="/datenschutz" className="underline hover:text-primary" target="_blank">Datenschutzerklärung</Link> gelesen. Meine Daten werden nur für diese Buchung verwendet. *</span>
                </label>
                <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm py-4 hover:bg-primary/90 disabled:opacity-60">{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gebucht …</> : <>Platz sichern <ArrowRight className="w-4 h-4" /></>}</button>
                <p className="text-center text-xs text-foreground/30">Fragen? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</a></p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
