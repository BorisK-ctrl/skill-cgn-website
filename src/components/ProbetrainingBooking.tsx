/*
 * Probetraining buchen auf /probetraining, Kalender zuerst (Boris, 19.11.2026): freie Zeiten sofort sichtbar (/api/probetraining/slots, live aus
 * unseren Google-Kalendern, gleiche Kollisionsprüfung wie das Onboarding), Uhrzeit antippen, dann Name, E-Mail, Telefon, PLZ, Urban Sports Club.
 * Buchen: /api/probetraining/start (Token, 2 Stunden gültig) → /api/termin/book → bei Erfolg Lead in Magicline mit der gebuchten Zeit.
 * Fehler stehen direkt am Knopf. Nur wenn die Zeit wirklich weg ist (409), wird die Auswahl gelöscht; Eingaben bleiben immer stehen.
 * Live: lädt jede Minute neu (höchstens 30 Minuten) und beim Zurückkehren in den Tab. Ohne Google-Anbindung (oder bei zu vielen Abrufen)
 * zeigt die Seite fallback: Formular mit Weiterleitung zur Google-Terminseite.
 * kind="onboarding": dieselbe Buchung für die offene Seite /onboarding (Mitglieder ohne persönlichen Link, z. B. aus der Magicline-Mail):
 * 90 Minuten, /api/onboarding/frei und /api/onboarding/start, Vertragsnummer optional, kein Lead (ist schon Mitglied).
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
const when = (iso: string) => `${dayChip(dayOf(iso))}, ${timeOf(iso)} Uhr`;

const CFG = {
  probetraining: { label: "Probetraining", slots: "/api/probetraining/slots", start: "/api/probetraining/start", lead: true, google: true,
    intro: "30 Minuten mit Coach: Erstgespräch und 3D Scan. Tipp auf Tag und Uhrzeit, dann trägst du dich ein. Die Bestätigung kommt sofort per E-Mail.",
    wa: "Hallo, ich möchte ein Probetraining buchen." },
  onboarding: { label: "Onboarding", slots: "/api/onboarding/frei", start: "/api/onboarding/start", lead: false, google: false,
    intro: "Tipp auf Tag und Uhrzeit, dann trägst du dich ein. Die Bestätigung kommt sofort per E-Mail.",
    wa: "Hi Boris, ich möchte meinen Onboarding-Termin ausmachen." },
} as const;

export default function ProbetrainingBooking({ fallback, kind = "probetraining", onBooked }: { fallback: ReactNode; kind?: "probetraining" | "onboarding"; onBooked?: (booked: boolean) => void }) {
  const cfg = CFG[kind];
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [byDay, setByDay] = useState<Record<string, Free[]>>({});
  const [day, setDay] = useState("");
  const [pick, setPick] = useState<Free | null>(null);
  const [note, setNote] = useState<string | null>(null);         // Hinweis am Kalender (Zeit weg)
  const [formNote, setFormNote] = useState<string | null>(null); // Hinweis am Knopf (Eingaben, Verbindung, schon gebucht)
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [first, setFirst] = useState("");
  const [showForm, setShowForm] = useState(false); // bleibt stehen, auch wenn die Zeit weggeht: Eingaben gehen nicht verloren
  const tokenRef = useRef<{ key: string; t: string } | null>(null);
  const leadRef = useRef<string>("");
  const pickRef = useRef<Free | null>(null); pickRef.current = pick;
  const busyRef = useRef(false); busyRef.current = busy;
  const phaseRef = useRef<Phase>("loading"); phaseRef.current = phase;
  const lastLoad = useRef(0), autoCount = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const toCalendar = () => window.setTimeout(() => (rootRef.current?.closest("section") || rootRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  /* Freie Zeiten laden. silent = im Hintergrund: Fehler lassen die Liste stehen */
  const load = useCallback(async (silent = false) => {
    lastLoad.current = Date.now();
    try {
      const r = await fetch(cfg.slots, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (phaseRef.current === "booked") return;
      if ((r.ok && j.available === false) || (r.status === 429 && !silent)) { if (!silent) setPhase("fallback"); return; }
      if (!r.ok || !j.byDay) { if (!silent) { setNote(j.error || "Kalender gerade nicht erreichbar."); setPhase("error"); } return; }
      const next: Record<string, Free[]> = j.byDay;
      const days = Object.keys(next).sort();
      setByDay(next);
      setDay(cur => (cur && next[cur] ? cur : days[0] || ""));
      const p = pickRef.current;
      if (p && !Object.values(next).some(list => list.some(f => f.start === p.start))) { setPick(null); setNote(`${when(p.start)} ist inzwischen vergeben. Bitte wähle eine andere Zeit.`); toCalendar(); }
      setPhase("pick");
    } catch { if (!silent) { setNote("Kalender gerade nicht erreichbar."); setPhase("error"); } }
  }, [cfg.slots]);
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

  useEffect(() => { onBooked?.(phase === "booked"); }, [phase, onBooked]);
  const days = useMemo(() => Object.keys(byDay).sort(), [byDay]);
  const free = byDay[day] || [];
  const choose = (f: Free) => {
    const firstPick = !showForm; setPick(f); setShowForm(true); setNote(null); setFormNote(null);
    if (firstPick) window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    if (busy) return;
    if (!pick) { setFormNote("Bitte oben eine Uhrzeit wählen."); toCalendar(); return; }
    if (!f.checkValidity()) { f.reportValidity(); return; }
    setBusy(true); setFormNote(null); setNote(null);
    const d = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
    const start = pick.start;
    const key = JSON.stringify([d.firstname, d.lastname, d.email, d.phone, d.plz, d.usc, d.vertrag].map(v => (v || "").trim().toLowerCase()));
    try {
      /* 1. Zugang für diese Person (bei Wiederholung mit gleichen Daten wiederverwenden) */
      if (tokenRef.current?.key !== key) {
        const r = await fetch(cfg.start, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.available === false) { setPhase("fallback"); return; }
        if (!r.ok || !j?.t) { setFormNote(j?.error || "Verbindung gestört. Bitte noch einmal tippen."); return; }
        tokenRef.current = { key, t: j.t };
      }
      /* 2. Buchen */
      const r = await fetch("/api/termin/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: tokenRef.current!.t, start }) });
      const j = await r.json().catch(() => null);
      if (j?.ok) {
        /* 3. Lead in Magicline mit der wirklich gebuchten Zeit (einmal je Person und Seitenaufruf, Fehler blockieren nichts) */
        if (cfg.lead && leadRef.current !== key) {
          leadRef.current = key;
          createLead({ firstname: d.firstname.trim(), lastname: d.lastname.trim(), email: d.email.trim(), phone: d.phone.trim(),
            notes: `Probetraining über Website. PLZ ${d.plz.trim()}. Urban Sports Club: ${d.usc}. Termin über den Website-Kalender: ${longDay(j.start)}, ${timeOf(j.start)} Uhr.` }).catch(err => console.warn("lead", err));
          track("Lead", { content_name: "Probetraining" });
        }
        setFirst(d.firstname.trim()); setBooked({ start: j.start, end: j.end, coach: j.coach, google: j.google, ics: j.ics }); setPhase("booked");
        track("Schedule", { content_name: cfg.label }); trackEvent(`${kind}_booked`, { content_name: cfg.label });
        toCalendar();
      } else if (j?.alreadyBooked) {
        setFormNote(j.error);
      } else if (r.status === 409) {
        /* Zeit weg (oder gerade in Buchung bei jemand anderem): Auswahl löschen, Liste neu, zurück zum Kalender */
        setPick(null); setNote(j?.error || "Diese Zeit ist gerade weggegangen. Bitte wähle eine andere."); load(true); toCalendar();
      } else if (r.status === 401) {
        tokenRef.current = null; setFormNote("Die Sitzung ist abgelaufen. Bitte noch einmal tippen.");
      } else {
        /* 429, 5xx, Zeitüberschreitung ohne JSON: Auswahl behalten, einfach noch einmal tippen (doppelte Einträge verhindert der Server) */
        setFormNote(j?.error && r.status === 429 ? j.error : "Verbindung oder Kalender gestört. Bitte noch einmal tippen.");
      }
    } catch { setFormNote("Verbindung fehlgeschlagen. Bitte noch einmal tippen."); }
    finally { setBusy(false); }
  }

  const wa = `${WHATSAPP}?text=${encodeURIComponent(cfg.wa)}`;

  if (phase === "fallback") return <>{fallback}</>;

  if (phase === "loading") return (
    <div className="mt-6 flex min-h-[220px] items-start gap-3 text-sm text-foreground/60" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Freie Termine werden geladen …</div>
  );

  if (phase === "error") return (
    <div className="mt-6 border-l-4 border-primary bg-card p-5 text-sm text-foreground/80" role="alert">
      <p>{note}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => { setNote(null); setPhase("loading"); load(); }} className="btn">Noch einmal laden</button>
        {cfg.google ? <a href={GOOGLE_BOOKING} className="btn-ghost" onClick={() => track("Schedule", { content_name: "Probetraining" })}>Termin über Google wählen</a>
          : <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost"><MessageCircle className="h-4 w-4" /> Termin per WhatsApp</a>}
      </div>
    </div>
  );

  if (phase === "booked" && booked) return (
    <div ref={rootRef} className="mt-6 max-w-2xl border-2 border-primary bg-card p-5 md:p-7" role="status" aria-live="polite">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary"><Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} /></span><p className="text-3xl font-black uppercase leading-none">Termin steht{first ? `, ${first}` : ""}.</p></div>
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

  const otherDay = pick && dayOf(pick.start) !== day;
  return (
    <div ref={rootRef} className="max-w-2xl">
      <p className="lead mute">{cfg.intro}</p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/50">Uhrzeiten in Köln · live aus unserem Kalender</p>
      {note && <p role="alert" className="mt-3 border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary">{note}</p>}
      {days.length === 0 ? (
        <div className="mt-3 border-2 border-foreground/15 p-5 text-sm leading-relaxed text-foreground/75">
          In den nächsten drei Wochen ist online gerade nichts frei. Schreib uns kurz{cfg.google ? " oder wähl einen Termin über Google" : ", wir finden einen Termin"}.
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn"><MessageCircle className="h-4 w-4" /> Termin per WhatsApp</a>
            {cfg.google && <a href={GOOGLE_BOOKING} className="btn-ghost" onClick={() => track("Schedule", { content_name: "Probetraining" })}>Termin über Google wählen</a>}
          </div>
        </div>
      ) : (
        <>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2" role="tablist" aria-label="Tag wählen">
            {days.map(d => (
              <button key={d} type="button" role="tab" aria-selected={day === d} onClick={() => setDay(d)}
                className={`shrink-0 border-2 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] ${day === d ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 text-foreground/75 hover:border-primary/60"}`}>{dayChip(d)}</button>
            ))}
          </div>
          {otherDay && <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">Gewählt: {when(pick!.start)}</p>}
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
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">{pick ? `Dein Termin: ${when(pick.start)}` : "Bitte oben eine Uhrzeit wählen"}</p>
          <label className="label" htmlFor="pt-vn">Vorname</label><input className="input" id="pt-vn" name="firstname" required maxLength={40} autoComplete="given-name" />
          <label className="label" htmlFor="pt-nn">Nachname</label><input className="input" id="pt-nn" name="lastname" required maxLength={40} autoComplete="family-name" />
          <label className="label" htmlFor="pt-em">E-Mail</label><input className="input" id="pt-em" name="email" type="email" required maxLength={120} autoComplete="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Bitte eine gültige E-Mail-Adresse, z. B. max@beispiel.de" />
          <label className="label" htmlFor="pt-tel">Handynummer</label><input className="input" id="pt-tel" name="phone" type="tel" required maxLength={40} autoComplete="tel" placeholder="+49 …" pattern="(?:\D*\d){6,}\D*" title="Bitte eine Handynummer mit mindestens 6 Ziffern" />
          {kind === "probetraining" ? <>
            <label className="label" htmlFor="pt-plz">Postleitzahl</label><input className="input" id="pt-plz" name="plz" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required autoComplete="postal-code" placeholder="50667" title="Bitte eine fünfstellige Postleitzahl" />
            <p className="label">Trainierst du über Urban Sports Club?</p>
            <div className="radio-row">
              <label><input type="radio" name="usc" value="nein" required />Nein</label>
              <label><input type="radio" name="usc" value="ja" />Ja</label>
            </div>
          </> : <>
            <label className="label" htmlFor="pt-vertrag">Vertragsnummer <span className="font-normal text-foreground/50">(optional, steht in deiner Mail von Magicline)</span></label><input className="input" id="pt-vertrag" name="vertrag" inputMode="numeric" maxLength={20} placeholder="z. B. 1215769690" />
          </>}
          <p className="text-sm mute mt-4">Mit dem Absenden stimmst du zu, dass wir dich zu deinem {cfg.label} per E-Mail und Telefon kontaktieren. <Link to="/datenschutz" className="underline">Datenschutz</Link></p>
          {formNote && <p role="alert" className="mt-4 border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary">{formNote}</p>}
          <div className="btns"><button className="btn w-full justify-center sm:w-auto" type="submit" disabled={busy || !pick}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird eingetragen …</> : pick ? <>{cfg.label} {when(pick.start)} buchen <ArrowRight className="h-4 w-4" /></> : "Erst Uhrzeit wählen"}</button></div>
        </form>
      )}
    </div>
  );
}
