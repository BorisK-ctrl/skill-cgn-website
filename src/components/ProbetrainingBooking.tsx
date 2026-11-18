/*
 * Probetraining buchen auf /probetraining, Kalender zuerst (Boris, 19.11.2026): freie Zeiten sofort sichtbar (/api/probetraining/slots, live aus
 * unseren Google-Kalendern, gleiche Kollisionsprüfung wie das Onboarding), Uhrzeit antippen, dann Name, E-Mail, Telefon, PLZ, Urban Sports Club.
 * Buchen: /api/probetraining/start (Token) → Lead in Magicline → /api/termin/book. Ist die Zeit inzwischen weg, bleiben die Eingaben stehen.
 * Live: lädt jede Minute neu (höchstens 30 Minuten) und beim Zurückkehren in den Tab. Ohne Google-Anbindung zeigt die Seite fallback (Formular
 * mit Weiterleitung zur Google-Terminseite).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarPlus, Check, Loader2, MessageCircle } from "lucide-react";
import { createLead, GOOGLE_BOOKING, WHATSAPP } from "@/lib/magicline";
import { track } from "@/lib/pixel";
import { trackEvent } from "@/lib/events";

interface Free { start: string; end: string }
interface Booked extends Free { coach?: string; google?: string; ics?: string }
type Phase = "loading" | "pick" | "booked" | "fallback" | "error";

const TZ = "Europe/Berlin";
const REFRESH_MS = 60000, REFRESH_MAX = 30, REFRESH_GAP_MS = 15000;
const dayChip = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });

export default function ProbetrainingBooking({ fallback }: { fallback: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [byDay, setByDay] = useState<Record<string, Free[]>>({});
  const [day, setDay] = useState("");
  const [pick, setPick] = useState<Free | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [first, setFirst] = useState("");
  const [showForm, setShowForm] = useState(false); // bleibt stehen, auch wenn die Zeit weggeht: Eingaben gehen nicht verloren
  const tokenRef = useRef<{ key: string; t: string } | null>(null);
  const leadRef = useRef(false);
  const pickRef = useRef<Free | null>(null); pickRef.current = pick;
  const busyRef = useRef(false); busyRef.current = busy;
  const lastLoad = useRef(0), autoCount = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  /* Freie Zeiten laden. silent = im Hintergrund: Fehler lassen die Liste stehen */
  const load = useCallback(async (silent = false) => {
    lastLoad.current = Date.now();
    try {
      const r = await fetch("/api/probetraining/slots", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.available === false) { if (!silent) setPhase("fallback"); return; }
      if (!r.ok || !j.byDay) { if (!silent) { setNote(j.error || "Kalender gerade nicht erreichbar."); setPhase("error"); } return; }
      const next: Record<string, Free[]> = j.byDay;
      const days = Object.keys(next).sort();
      setByDay(next);
      setDay(cur => (cur && next[cur] ? cur : days[0] || ""));
      const p = pickRef.current;
      if (p && !Object.values(next).some(list => list.some(f => f.start === p.start))) { setPick(null); setNote("Deine gewählte Zeit ist inzwischen vergeben. Bitte wähle eine andere."); }
      setPhase(ph => (ph === "booked" ? ph : "pick"));
    } catch { if (!silent) { setNote("Kalender gerade nicht erreichbar."); setPhase("error"); } }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Live halten: jede Minute (höchstens 30-mal) und beim Zurückkehren in den Tab */
  useEffect(() => {
    if (phase !== "pick") return;
    const visible = () => document.visibilityState === "visible" && !busyRef.current;
    const tick = () => { if (visible() && autoCount.current < REFRESH_MAX) { autoCount.current++; load(true); } };
    const back = () => { if (visible() && Date.now() - lastLoad.current > REFRESH_GAP_MS) { autoCount.current = 0; load(true); } };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [phase, load]);

  const days = useMemo(() => Object.keys(byDay).sort(), [byDay]);
  const free = byDay[day] || [];
  const choose = (f: Free) => { const firstPick = !showForm; setPick(f); setShowForm(true); setNote(null); if (firstPick) window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    if (busy) return;
    if (!pick) { setNote("Bitte oben eine Uhrzeit wählen."); document.getElementById("buchen")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (!f.checkValidity()) { f.reportValidity(); return; }
    setBusy(true); setNote(null);
    const d = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
    const start = pick.start;
    try {
      /* 1. Token für diese Person (bei Wiederholung mit gleichen Daten wiederverwenden) */
      const key = JSON.stringify([d.firstname, d.lastname, d.email, d.phone, d.plz, d.usc].map(v => (v || "").trim().toLowerCase()));
      if (tokenRef.current?.key !== key) {
        const r = await fetch("/api/probetraining/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.available === false) { setPhase("fallback"); return; }
        if (!r.ok || !j.t) { setNote(j.error || "Das hat nicht geklappt. Bitte noch einmal versuchen."); return; }
        tokenRef.current = { key, t: j.t };
      }
      /* 2. Lead in Magicline (einmal je Seitenaufruf, Fehler blockieren die Buchung nicht) */
      if (!leadRef.current) {
        leadRef.current = true;
        createLead({ firstname: d.firstname.trim(), lastname: d.lastname.trim(), email: d.email.trim(), phone: d.phone.trim(),
          notes: `Probetraining über Website. PLZ ${d.plz.trim()}. Urban Sports Club: ${d.usc}. Termin über den Website-Kalender: ${longDay(start)}, ${timeOf(start)} Uhr.` }).catch(err => console.warn("lead", err));
        track("Lead", { content_name: "Probetraining" });
      }
      /* 3. Buchen */
      const r = await fetch("/api/termin/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: tokenRef.current!.t, start }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        setFirst(d.firstname.trim()); setBooked({ start: j.start, end: j.end, coach: j.coach, google: j.google, ics: j.ics }); setPhase("booked");
        track("Schedule", { content_name: "Probetraining" }); trackEvent("probetraining_booked", { content_name: "Probetraining" });
        window.setTimeout(() => document.getElementById("buchen")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else if (j.booked) { setFirst(d.firstname.trim()); setBooked(j.booked); setPhase("booked"); setNote("Du hast schon einen Probetraining-Termin."); }
      else { setNote(j.error || "Diese Zeit ist gerade weggegangen. Bitte wähle eine andere."); setPick(null); load(true); }
    } catch { setNote("Verbindung fehlgeschlagen. Bitte noch einmal tippen."); }
    finally { setBusy(false); }
  }

  const wa = `${WHATSAPP}?text=${encodeURIComponent("Hallo, ich möchte ein Probetraining buchen.")}`;

  if (phase === "fallback") return <>{fallback}</>;

  if (phase === "loading") return (
    <div className="mt-6 flex min-h-[220px] items-start gap-3 text-sm text-foreground/60" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Freie Termine werden geladen …</div>
  );

  if (phase === "error") return (
    <div className="mt-6 border-l-4 border-primary bg-card p-5 text-sm text-foreground/80" role="alert">
      <p>{note}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => { setNote(null); setPhase("loading"); load(); }} className="btn">Noch einmal laden</button>
        <a href={GOOGLE_BOOKING} className="btn-ghost" onClick={() => track("Schedule", { content_name: "Probetraining" })}>Termin über Google wählen</a>
      </div>
    </div>
  );

  if (phase === "booked" && booked) return (
    <div className="mt-6 max-w-2xl border-2 border-primary bg-card p-5 md:p-7" role="status">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary"><Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} /></span><p className="text-3xl font-black uppercase leading-none">Termin steht{first ? `, ${first}` : ""}.</p></div>
      {note && <p className="mt-3 text-sm text-foreground/70">{note}</p>}
      <p className="mt-4 font-mono text-lg text-primary">{longDay(booked.start)}<br />{timeOf(booked.start)} bis {timeOf(booked.end)} Uhr</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">{booked.coach ? `Mit ${booked.coach}, ` : ""}Herzogstraße 16–20, zwei Minuten vom Neumarkt. Die Bestätigung kommt per Mail. Bring Sportkleidung und saubere Hallenschuhe mit.</p>
      {(booked.google || booked.ics) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {booked.google && <a href={booked.google} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 border-2 border-foreground/30 px-3 text-[11px] font-black uppercase tracking-widest hover:border-primary"><CalendarPlus className="h-4 w-4 shrink-0" /> Google</a>}
          {booked.ics && <a href={booked.ics} className="flex min-h-12 items-center justify-center gap-2 border-2 border-foreground/30 px-3 text-[11px] font-black uppercase tracking-widest hover:border-primary"><CalendarPlus className="h-4 w-4 shrink-0" /> Apple / Outlook</a>}
        </div>
      )}
      <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 text-sm text-foreground/70 underline underline-offset-4 hover:text-primary"><MessageCircle className="h-4 w-4" /> Termin verschieben? Schreib uns</a>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <p className="lead mute">30 Minuten mit Coach: Erstgespräch und 3D Scan. Tipp auf Tag und Uhrzeit, dann trägst du dich ein. Die Bestätigung kommt sofort per E-Mail.</p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/50">Uhrzeiten in Köln · live aus unserem Kalender</p>
      {note && <p role="alert" className="mt-3 border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary">{note}</p>}
      {days.length === 0 ? (
        <div className="mt-3 border-2 border-foreground/15 p-5 text-sm leading-relaxed text-foreground/75">
          In den nächsten drei Wochen ist online gerade nichts frei. Schreib uns kurz, wir finden einen Termin.
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn mt-4 w-full justify-center"><MessageCircle className="h-4 w-4" /> Termin per WhatsApp</a>
        </div>
      ) : (
        <>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2" role="tablist" aria-label="Tag wählen">
            {days.map(d => (
              <button key={d} type="button" role="tab" aria-selected={day === d} onClick={() => { setDay(d); setNote(null); if (pick && dayOf(pick.start) !== d) setPick(null); }}
                className={`shrink-0 border-2 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] ${day === d ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 text-foreground/75 hover:border-primary/60"}`}>{dayChip(d)}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={`Uhrzeit am ${day ? dayChip(day) : ""} wählen`}>
            {free.map(f => (
              <button key={f.start} type="button" role="radio" aria-checked={pick?.start === f.start} onClick={() => choose(f)}
                className={`min-h-12 border-2 font-mono text-base font-bold ${pick?.start === f.start ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 hover:border-primary"}`}>{timeOf(f.start)}</button>
            ))}
          </div>
          {!pick && <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-foreground/70 underline underline-offset-4 hover:text-primary"><MessageCircle className="h-4 w-4" /> Keine passende Zeit? Schreib uns</a>}
        </>
      )}

      {showForm && (
        <form ref={formRef} onSubmit={submit} noValidate className="mt-8 scroll-mt-24 border-t-2 border-primary pt-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">{pick ? `Dein Termin: ${dayChip(dayOf(pick.start))}, ${timeOf(pick.start)} Uhr` : "Bitte oben eine Uhrzeit wählen"}</p>
          <label className="label" htmlFor="pt-vn">Vorname</label><input className="input" id="pt-vn" name="firstname" required autoComplete="given-name" />
          <label className="label" htmlFor="pt-nn">Nachname</label><input className="input" id="pt-nn" name="lastname" required autoComplete="family-name" />
          <label className="label" htmlFor="pt-em">E-Mail</label><input className="input" id="pt-em" name="email" type="email" required autoComplete="email" />
          <label className="label" htmlFor="pt-tel">Handynummer</label><input className="input" id="pt-tel" name="phone" type="tel" required autoComplete="tel" placeholder="+49 …" />
          <label className="label" htmlFor="pt-plz">Postleitzahl</label><input className="input" id="pt-plz" name="plz" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required autoComplete="postal-code" placeholder="50667" />
          <p className="label">Trainierst du über Urban Sports Club?</p>
          <div className="radio-row">
            <label><input type="radio" name="usc" value="nein" required />Nein</label>
            <label><input type="radio" name="usc" value="ja" />Ja</label>
          </div>
          <p className="text-sm mute mt-4">Mit dem Absenden stimmst du zu, dass wir dich zu deinem Probetraining per E-Mail und Telefon kontaktieren. <Link to="/datenschutz" className="underline">Datenschutz</Link></p>
          <div className="btns"><button className="btn w-full justify-center sm:w-auto" type="submit" disabled={busy || !pick}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird eingetragen …</> : pick ? <>Probetraining {dayChip(dayOf(pick.start))}, {timeOf(pick.start)} Uhr buchen <ArrowRight className="h-4 w-4" /></> : "Erst Uhrzeit wählen"}</button></div>
        </form>
      )}
    </div>
  );
}
