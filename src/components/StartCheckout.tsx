/*
 * Abschlussformular für /start39 und /back39: drei Schritte auf Karten, sofort sichtbar, kein Klick davor.
 * Schritt 1 Kontakt → Lead in Magicline + Abbrecher-Token (Netlify Function). Schritt 2 Adresse, Geburtsdatum, Start.
 * Schritt 3 IBAN mit Live-Prüfung, Zustimmungssatz, Unterschrift (Magicline verlangt sie: contractSignaturesRequired=true im rate-bundle).
 * Eingaben liegen in sessionStorage (ohne IBAN und Unterschrift), Reload macht an derselben Stelle weiter.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, Loader2, Eraser, Pencil } from "lucide-react";
import { createContract, createLead, ibanValid, WHATSAPP, type RateBundleTerm, type ContractResult } from "@/lib/magicline";
import { trackOnce, trackCustom, trackCustomOnce } from "@/lib/pixel";
import { utmParams, landingSource, setSessionSource } from "@/lib/events";
import { membershipPaymentLink } from "@/lib/stripe";
import { consent } from "@/lib/pixel";
const cookie = (n: string) => { try { return document.cookie.split("; ").find(c => c.startsWith(n + "="))?.split("=")[1] || ""; } catch { return ""; } };

/** Unter 18: kein Onlineabschluss, Hinweis mit WhatsApp-Knopf (Express-Block und Formular). */
export const MINOR_TEXT = "Onlineabschluss nur ab 18 Jahren";
export function MinorNotice({ offerName }: { offerName: string }) {
  return (
    <div className="mt-2 border border-[#FBFF00] bg-[#2A3133] p-4">
      <p className="text-sm font-bold text-white">Unter 18? Dann geht es persönlich weiter.</p>
      <p className="mt-1 text-xs leading-relaxed text-white/70">Für den Vertrag brauchen wir die Unterschrift eines Erziehungsberechtigten. Komm mit ihm ins Studio, wir machen den Rest vor Ort.</p>
      <a href={`${WHATSAPP}?text=${encodeURIComponent(`Hi, ich bin unter 18 und möchte ${offerName} abschließen. Wann kann ich mit meinen Eltern vorbeikommen?`)}`} target="_blank" rel="noopener noreferrer" className="campaign-button mt-3 inline-flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-white">Termin per WhatsApp</a>
    </div>
  );
}
export interface ResumeData { token: string; firstName: string; lastName: string; email: string; phone: string; months?: number | null; leadUuid?: string; customerNumber?: string; utm?: string }
/** Quelle der Sitzung, auf der Einstiegsseite bestimmt (lib/events.ts landingSource), auch wenn der Weg über die Startseite führt */
export const utmSource = (withContent = false): string => landingSource(withContent);

interface Form { firstName: string; lastName: string; email: string; phone: string; birthDate: string; street: string; streetNumber: string; zipCode: string; city: string; startDate: string; iban: string; accountHolder: string }
type Errors = Partial<Record<keyof Form, string>>;

/** Nächster Montag als YYYY-MM-DD (heute Montag → in einer Woche). */
export function nextMonday(from = new Date()) {
  const d = new Date(from); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
/* Geburtsdatum mit Startwert 01.01.1990, damit der native Datumswähler auf mobil dort beginnt (Vorgabe Boris 27.09.2026). */
const emptyForm = (): Form => ({ firstName: "", lastName: "", email: "", phone: "", birthDate: "1990-01-01", street: "", streetNumber: "", zipCode: "", city: "", startDate: nextMonday(), iban: "", accountHolder: "" });
const PERSIST: (keyof Form)[] = ["firstName", "lastName", "email", "phone", "birthDate", "street", "streetNumber", "zipCode", "city", "startDate", "accountHolder"];
const newToken = () => { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(24))) s += a[x % a.length]; return s; };
const fmtDe = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("de-DE") : "");
const formatIban = (raw: string) => raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ").slice(0, 42);

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div data-err={error ? "1" : undefined}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">{label}</label>
      {children}
      {error ? <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {error}</p> : hint ? <p className="mt-1.5 text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}
function Input(p: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: "text" | "email" | "tel" | "numeric" | "decimal"; autoComplete?: string; hasError?: boolean; min?: string; max?: string; onFocus?: () => void; ok?: boolean; className?: string }) {
  return (
    <div className="relative">
      <input type={p.type || "text"} inputMode={p.inputMode} autoComplete={p.autoComplete} value={p.value} min={p.min} max={p.max} onFocus={p.onFocus} onChange={e => p.onChange(e.target.value)} placeholder={p.placeholder}
        className={`campaign-field min-h-[52px] text-base ${p.className || ""} ${p.hasError ? "!border-[#FBFF00]" : p.ok ? "!border-emerald-400" : ""}`} />
      {p.ok && <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />}
    </div>
  );
}
function DoneCard({ n, title, summary, onEdit }: { n: number; title: string; summary: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 border border-white/10 bg-[#141a1b] px-4 py-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-3 w-3 text-black" /></span>
      <div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Schritt {n} · {title}</p><p className="mt-0.5 truncate text-sm text-white/80">{summary}</p></div>
      <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FBFF00] hover:text-white"><Pencil className="h-3 w-3" /> Bearbeiten</button>
    </div>
  );
}

export interface PosOptions { staff: string; startDate: string }
export interface SummaryRow { label: string; value: string }
export default function StartCheckout({ term, offerName, path, priceLine, months, resume, onStepChange, pos, onSuccess, summary, cancelNote, startToday, successPath = "/danke", utmContent, notes }: { term: RateBundleTerm | null; offerName: string; path: "/start39" | "/back39" | "/vor-ort" | "/checkout" | "/blackweek"; priceLine: string; months?: 1 | 12; resume?: ResumeData | null; onStepChange?: (step: number) => void;
  /** Zusammenfassung vor der Unterschrift: Tarif, Laufzeit, Preis, Classes, Parken. */ summary?: SummaryRow[]; cancelNote?: string;
  /** Vor-Ort-Modus (iPad): kein Interessent, kein Tracking, keine Abbrecher-Mail, Startdatum aus der Auswahl, Erfolg inline statt /danke. */
  pos?: PosOptions; onSuccess?: (r: ContractResult, info: { firstName: string; lastName: string; email: string }) => void;
  /** Vertragsstart immer am Tag des Abschlusses (contractStartType CONTRACT_CONCLUSION, z. B. Black Week): kein Datumsfeld. */ startToday?: boolean;
  /** Ziel nach dem Abschluss, Standard /danke. */ successPath?: string;
  /** utm_content zusätzlich in die Magicline-Notizen schreiben. */ utmContent?: boolean;
  /** Eigene Notizen statt "<Angebot> Website, Schritt 1 abgeschickt" und "Onlineabschluss <Angebot> Landingpage". */ notes?: { lead: string; contract: string } }) {
  const KEY = "skill-checkout-" + path.slice(1);
  const isPos = !!pos;
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(emptyForm);
  const [step, setStepRaw] = useState(1);
  const [token, setToken] = useState("");
  /* Interessent aus Schritt 1: uuid wird in Schritt 3 als identityToken mitgegeben, damit derselbe Kunde den Vertrag bekommt. */
  const [lead, setLead] = useState<{ uuid: string; customerNumber: string }>({ uuid: "", customerNumber: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiErrorCustomer, setApiErrorCustomer] = useState("");
  /* Request und Antwort jeder Vertragsanlage ins Protokoll (Netlify Function), ohne IBAN. Scheitert still. */
  const log = (stage: string, data: Record<string, unknown>) => fetch("/api/checkout-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, campaign: offerName, stage, ...data }), keepalive: true }).catch(() => {});
  const [pending, setPending] = useState(false);
  const [sigError, setSigError] = useState("");
  const [submitHint, setSubmitHint] = useState("");
  const [idle, setIdle] = useState(false);
  /* Zahlart: SEPA über Magicline oder Karte/Wallet über Stripe (nur wenn ein Payment Link für das Angebot existiert, nicht vor Ort) */
  /* Entscheidung 2026-10-31: Mitgliedschaften online nur per SEPA-Lastschrift. Karte und Apple Pay gibt es nur für Einmalkäufe im Shop. */
  const cardAvailable = false as boolean;
  const [payMethod, setPayMethod] = useState<"sepa" | "card">("sepa");
  const [restored, setRestored] = useState(false);
  const userNav = useRef(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const price = term?.price ?? 39;

  /* Sitzung wiederherstellen: erst sessionStorage, dann Token aus der Erinnerungsmail (startet in Schritt 2). */
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (s?.form) { setForm(f => ({ ...f, ...s.form })); if (s.step > 1) setStepRaw(Math.min(3, s.step)); if (s.token) setToken(s.token); if (s.lead?.uuid) setLead(s.lead); }
    } catch {}
    setRestored(true);
  }, [KEY]);
  useEffect(() => {
    if (!resume) return;
    setForm(f => ({ ...f, firstName: resume.firstName || f.firstName, lastName: resume.lastName || f.lastName, email: resume.email || f.email, phone: resume.phone || f.phone }));
    setToken(resume.token); setStepRaw(s => Math.max(s, 2));
    if (resume.leadUuid) setLead({ uuid: resume.leadUuid, customerNumber: resume.customerNumber || "" });
    /* Rückkehr über die Erinnerungsmail (nur dort steht ?resume=): Quelle aus Schritt 1 behalten und markieren */
    const orig = (resume.utm || "").trim().slice(0, 170) || "unbekannt";
    setSessionSource(/Erinnerungsmail/.test(orig) ? orig : `${orig} · über Erinnerungsmail`);
  }, [resume]);
  useEffect(() => {
    if (!restored) return;
    const keep: Partial<Form> = {}; for (const k of PERSIST) (keep as any)[k] = form[k];
    try { sessionStorage.setItem(KEY, JSON.stringify({ step, form: keep, token, lead })); } catch {}
  }, [form, step, token, lead, restored, KEY]);
  /* Abbruch in Schritt 2 oder 3 merken (Seite verlassen, Tab zu). Der Interessent aus Schritt 1 bleibt bestehen. */
  const stepRef2 = useRef(step); stepRef2.current = step;
  const tokenRef = useRef(token); tokenRef.current = token;
  useEffect(() => {
    const mark = () => { if (!isPos && stepRef2.current >= 2 && tokenRef.current) fetch("/api/checkout-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tokenRef.current, abandonedStep: stepRef2.current }), keepalive: true }).catch(() => {}); };
    const onHide = () => { if (document.visibilityState === "hidden") mark(); };
    window.addEventListener("pagehide", mark); document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("pagehide", mark); document.removeEventListener("visibilitychange", onHide); };
  }, []);
  useEffect(() => { onStepChange?.(step); }, [step, onStepChange]);
  useEffect(() => { if (pos?.startDate) setForm(f => ({ ...f, startDate: pos.startDate })); }, [pos?.startDate]);
  /* Vertragsstart am Abschlusstag: Datum immer auf heute halten, auch nach Wiederherstellung aus sessionStorage */
  useEffect(() => { if (startToday && form.startDate !== today()) setForm(f => ({ ...f, startDate: today() })); }, [startToday, form.startDate]);

  const setStep = (n: number) => { userNav.current = true; setStepRaw(n); setErrors({}); setApiError(null); };
  /* Autofocus auf das erste Feld des Schritts, nur nach einem Klick des Nutzers, nicht beim Laden. */
  useEffect(() => {
    if (!userNav.current) return;
    const el = stepRef.current?.querySelector<HTMLInputElement>("input:not([type=checkbox])");
    const t = window.setTimeout(() => { el?.focus({ preventScroll: true }); stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
    return () => window.clearTimeout(t);
  }, [step]);
  /* Kontoinhaber aus Schritt 1 vorbelegen */
  useEffect(() => { if (step === 3 && !form.accountHolder.trim()) setForm(f => ({ ...f, accountHolder: `${f.firstName} ${f.lastName}`.trim() })); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 60 Sekunden ohne Eingabe in Schritt 2 oder 3: dezenter WhatsApp-Hinweis unter dem Formular. */
  useEffect(() => {
    if (step < 2 || isPos) { setIdle(false); return; }
    let t = 0; const arm = () => { setIdle(false); window.clearTimeout(t); t = window.setTimeout(() => setIdle(true), 60000); };
    const el = rootRef.current; arm();
    const ev = ["input", "keydown", "pointerdown", "touchstart"] as const; ev.forEach(e => el?.addEventListener(e, arm));
    return () => { window.clearTimeout(t); ev.forEach(e => el?.removeEventListener(e, arm)); };
  }, [step]);

  const set = (k: keyof Form) => (v: string | boolean) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); };
  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = "Bitte Vornamen eingeben";
      if (!form.lastName.trim()) e.lastName = "Bitte Nachnamen eingeben";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.email.trim())) e.email = "Bitte gültige E-Mail eingeben";
      if (form.phone.replace(/\D/g, "").length < 8) e.phone = "Bitte Handynummer eingeben";
    }
    if (s === 2) {
      if (!form.birthDate) e.birthDate = "Bitte Geburtsdatum eingeben";
      else if ((Date.now() - new Date(form.birthDate).getTime()) / 31557600000 < 18) e.birthDate = MINOR_TEXT;
      if (!form.street.trim()) e.street = "Bitte Straße eingeben";
      if (!form.streetNumber.trim()) e.streetNumber = "Nr. fehlt";
      if (!/^\d{5}$/.test(form.zipCode.trim())) e.zipCode = "5-stellige PLZ";
      if (!form.city.trim()) e.city = "Bitte Ort eingeben";
      /* Start am Abschlusstag: immer heute, auch wenn die Seite über Mitternacht offen war (sonst hängt Schritt 2 ohne sichtbaren Fehler) */
      const sd = startToday ? today() : form.startDate;
      if (!sd || sd < today()) e.startDate = "Startdatum ab heute wählen";
    }
    if (s === 3 && payMethod === "sepa") {
      if (!ibanValid(form.iban)) e.iban = "Die IBAN ist nicht gültig";
      if (!form.accountHolder.trim()) e.accountHolder = "Bitte Kontoinhaber eingeben";
    }
    return e;
  };

  /* Abbrecher-Token an die Netlify Function; scheitert still, wenn die Function nicht erreichbar ist (lokaler Dev). */
  const saveLead = (tok: string, extra: Record<string, unknown> = {}) => fetch("/api/checkout-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, path, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), months, utm: utmSource(true), ...extra }) }).catch(() => {});

  const submitStep1 = () => {
    const e = validate(1); setErrors(e); if (Object.keys(e).length) return;
    const tok = token || newToken(); setToken(tok);
    /* Am Tresen ebenfalls als Interessent anlegen: so taucht jeder Abschluss in Magicline unter Interessenten → Eingang auf und wird mit dem Vertrag "Gewonnen". */
    if (isPos) {
      if (!lead.uuid) createLead({ firstname: form.firstName.trim(), lastname: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), notes: `${offerName} vor Ort (iPad)${pos?.staff ? ", Berater:in " + pos.staff : ""}` })
        .then(l => { if (l.uuid) setLead({ uuid: l.uuid, customerNumber: l.customerNumber }); log("lead", { response: { status: l.status, customerNumber: l.customerNumber, uuid: !!l.uuid } }); })
        .catch(e => log("lead-error", { error: String(e?.message || e) }));
      setStep(2); return;
    }
    /* Interessent in Magicline, einmal je Sitzung. Notiz mit Quelle; die uuid macht ihn in Schritt 3 zum Mitglied. */
    if (!lead.uuid) {
      createLead({ firstname: form.firstName.trim(), lastname: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), notes: `${notes?.lead || `${offerName} Website, Schritt 1 abgeschickt`}, Quelle: ${utmSource(utmContent)}` })
        .then(l => { if (l.uuid) { setLead({ uuid: l.uuid, customerNumber: l.customerNumber }); saveLead(tok, { leadUuid: l.uuid, customerNumber: l.customerNumber }); } else saveLead(tok); log("lead", { response: { status: l.status, customerNumber: l.customerNumber, uuid: l.uuid ? "ja" : "nein" } }); })
        .catch(e => { saveLead(tok); log("lead-error", { error: String(e?.message || e) }); });
    } else saveLead(tok);
    trackOnce("lead-" + path, "Lead", { content_name: offerName, content_category: "Membership", value: price, currency: "EUR", ...utmParams() });
    trackCustomOnce("schritt2-" + path, "Schritt2", { content_name: offerName });
    setStep(2);
  };
  const submitStep2 = () => {
    const e = validate(2); setErrors(e); if (Object.keys(e).length) return;
    /* Zahlungsschritt erreicht: InitiateCheckout, einmal je Sitzung */
    if (!isPos) { trackOnce("ic-" + path, "InitiateCheckout", { content_name: offerName, content_category: "Membership", value: price, currency: "EUR", ...utmParams() }); trackCustomOnce("schritt3-" + path, "Schritt3", { content_name: offerName }); }
    setStep(3);
  };
  const onIban = (v: string) => { const f = formatIban(v); set("iban")(f); setApiError(null); };
  const onFirstFocus = () => {};

  /* Unterschrift: Striche auf Canvas, Export als SVG (Base64) für Magicline. */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<number[][][]>([]); const cur = useRef<number[][]>([]); const drawing = useRef(false);
  useEffect(() => {
    if (step !== 3) return; const c = canvasRef.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr); strokes.current = [];
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const down = (e: PointerEvent) => { drawing.current = true; cur.current = [pos(e)]; c.setPointerCapture(e.pointerId); e.preventDefault(); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); const a = cur.current[cur.current.length - 1]; cur.current.push(p); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); e.preventDefault(); };
    const up = () => { if (drawing.current && cur.current.length > 1) { strokes.current.push(cur.current); setSigError(""); } drawing.current = false; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up); c.addEventListener("pointerleave", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); c.removeEventListener("pointercancel", up); c.removeEventListener("pointerleave", up); };
  }, [step]);
  const clearSig = () => { strokes.current = []; const c = canvasRef.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); };
  const sigSvg = () => { const c = canvasRef.current!; const w = c.offsetWidth, h = c.offsetHeight; const paths = strokes.current.map(s => `<path d="M${s.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>`).join(""); return btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`))); };

  const submit = async () => {
    const e = validate(3); setErrors(e); setSigError(strokes.current.length ? "" : "Bitte unterschreibe im Feld");
    if (Object.keys(e).length || !strokes.current.length) {
      /* Fehler stehen oft weit oberhalb des Knopfs (IBAN, Kontoinhaber): Hinweis direkt am Knopf und zum ersten Fehler springen */
      const missing = [...Object.values(e), ...(strokes.current.length ? [] : ["Unterschrift fehlt"])];
      setSubmitHint(missing.join(" · "));
      window.setTimeout(() => { const el = document.querySelector<HTMLElement>("[data-err]"); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.querySelector("input")?.focus({ preventScroll: true }); } }, 50);
      return;
    }
    setSubmitHint("");
    if (!term) { setApiError("Das Angebot ist gerade nicht erreichbar. Bitte lade die Seite neu."); return; }
    /* Zahlungsdaten abgeschickt: AddPaymentInfo, einmal je Sitzung */
    if (!isPos) trackOnce("payment-" + path, "AddPaymentInfo", { content_name: offerName, value: price, currency: "EUR", payment: payMethod, ...utmParams() });
    setPending(true); setApiError(null); setApiErrorCustomer("");
    const sig = sigSvg();
    /* Start am Abschlusstag (startToday): heute zum Zeitpunkt des Absendens, nicht der Stand beim Laden der Seite */
    const startDate = startToday ? today() : form.startDate;
    if (payMethod === "card") {
      /* Karte, Apple Pay, Google Pay: Vertragsdaten sichern, dann zu Stripe. Der Webhook legt den Magicline-Vertrag nach der Zahlung an, /danke wartet darauf. */
      const tok = token || newToken(); if (!token) setToken(tok);
      try {
        const r = await fetch("/api/checkout-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, path, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), months, utm: utmSource(true), leadUuid: lead.uuid || undefined, customerNumber: lead.customerNumber || undefined }) });
        if (!r.ok) throw new Error("Sitzung konnte nicht gespeichert werden");
        const r2 = await fetch("/api/checkout-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, card: { rateBundleTermId: term.id, startDate, dob: form.birthDate, street: form.street.trim(), houseNumber: form.streetNumber.trim(), zip: form.zipCode.trim(), city: form.city.trim(), signatureSvgBase64: sig, price: term.price, offerName, sourceUrl: location.href, fbp: cookie("_fbp"), fbc: cookie("_fbc") || (utmParams().fbclid ? `fb.1.${Date.now()}.${utmParams().fbclid}` : "") } }) });
        if (!r2.ok) throw new Error("Vertragsdaten konnten nicht gespeichert werden");
        try { sessionStorage.setItem("skill-contract-pending", JSON.stringify({ token: tok, offer: offerName, name: form.firstName.trim(), start: startDate, price: term.price })); } catch {}
        log("card-redirect", { request: { rateBundleTermId: term.id, startDate, price: term.price, payment: "card", identityToken: lead.uuid || null, consent: consent() } });
        window.location.href = membershipPaymentLink(offerName, tok, form.email.trim())!;
      } catch (ex: any) { setApiError(String(ex?.message || ex)); setPending(false); }
      return;
    }
    const request = { rateBundleTermId: term.id, startDate, price: term.price, identityToken: lead.uuid || null, leadCustomerNumber: lead.customerNumber || null, signatureChars: sig.length, strokes: strokes.current.length, firstname: form.firstName.trim(), lastname: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), dob: form.birthDate, zip: form.zipCode.trim(), city: form.city.trim(), accountHolder: form.accountHolder.trim(), ibanValid: ibanValid(form.iban) };
    try {
      const r: ContractResult = await createContract({
        rateBundleTermId: term.id, startDate, signatureSvgBase64: sig, identityToken: lead.uuid || undefined, notes: isPos ? `Abschluss vor Ort (iPad)${pos?.staff ? ", Berater:in " + pos.staff : ""}, ${offerName}` : `${notes?.contract || `Onlineabschluss ${offerName} Landingpage`}, Quelle: ${utmSource(utmContent)}`,
        firstname: form.firstName.trim(), lastname: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), dob: form.birthDate,
        street: form.street.trim(), houseNumber: form.streetNumber.trim(), zip: form.zipCode.trim(), city: form.city.trim(), accountHolder: form.accountHolder.trim(), iban: form.iban,
      });
      /* Nur mit Vertrags-ID von Magicline geht es weiter. createContract wirft sonst. */
      log("contract-ok", { request: { ...request, consent: consent(), fbp: !!cookie("_fbp"), fbc: !!cookie("_fbc") }, response: { status: r.status, contractId: r.contractId, customerId: r.customerId, customerNumber: r.customerNumber, paymentUrl: r.paymentUrl, followUpActionToken: r.followUpActionToken, raw: r.raw } });
      if (isPos) { const info = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() }; try { sessionStorage.removeItem(KEY); } catch {} setForm(emptyForm()); setStepRaw(1); setToken(""); clearSig(); onSuccess?.(r, info); return; }
      /* Vertrag bestätigt: Abbrecher-Token schließen und Purchase serverseitig (Conversions API) mit derselben event_id anstoßen */
      if (token) fetch("/api/checkout-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, done: true, contractId: r.contractId, customerId: r.customerId, customerNumber: r.customerNumber, startDate, value: term.price, consent: consent(), sourceUrl: location.href, zip: form.zipCode.trim(), city: form.city.trim(), fbp: cookie("_fbp"), fbc: cookie("_fbc") || (utmParams().fbclid ? `fb.1.${Date.now()}.${utmParams().fbclid}` : "") }), keepalive: true }).catch(() => {});
      try { sessionStorage.setItem("skill-contract", JSON.stringify({ offer: offerName, cid: r.contractId, customer: r.customerNumber, name: form.firstName.trim(), start: startDate, price: term.price, t: token || undefined })); sessionStorage.removeItem(KEY); } catch {}
      /* Verlangt Magicline noch einen Zahlungsschritt, dorthin statt auf /danke. */
      if (r.paymentUrl) { window.location.href = r.paymentUrl; return; }
      /* Purchase (Meta) und Conversion (Google) feuern auf /danke, erst jetzt. */
      navigate(`${successPath}?offer=${encodeURIComponent(offerName)}&vertrag=${encodeURIComponent(r.contractId)}`);
    } catch (ex: any) {
      const res: ContractResult | undefined = ex?.result;
      const msg = String(ex?.message || ex);
      log("contract-error", { request, response: res ? { status: res.status, contractId: res.contractId, customerId: res.customerId, customerNumber: res.customerNumber, raw: res.raw } : null, error: msg });
      setApiError(msg); setApiErrorCustomer(res?.customerNumber || "");
      /* Kunde bleibt Interessent mit Notiz, damit das Team nachfasst. */
      if (!lead.uuid) createLead({ firstname: form.firstName.trim(), lastname: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), notes: `Checkout Fehler ${offerName}: ${msg}${res?.customerNumber ? ` (Kunde ${res.customerNumber} angelegt, kein Vertrag)` : ""}`.slice(0, 300) }).catch(() => {});
      if (!isPos) trackCustom("CheckoutError", { content_name: offerName });
    } finally { setPending(false); }
  };

  const btn = "campaign-button flex min-h-14 w-full items-center justify-center gap-2 bg-[#FBFF00] px-4 py-4 text-center text-sm font-bold uppercase leading-snug tracking-[0.1em] text-black sm:px-6 sm:tracking-[0.14em] hover:bg-white disabled:opacity-60";
  const trust = <p className="campaign-mono mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-white/45">{cardAvailable ? "Sicher bezahlen per Karte, Apple Pay, Google Pay oder SEPA · keine Gebühr" : "Sicher bezahlen per SEPA-Lastschrift · keine Gebühr"}</p>;
  const contactNote = <p className="mt-2 text-center text-[11px] text-white/45">Wir melden uns bei Fragen per WhatsApp oder E-Mail. <Link to="/datenschutz" target="_blank" className="underline hover:text-white">Datenschutz</Link></p>;
  const ibanOk = ibanValid(form.iban);

  return (
    <div ref={rootRef} className="border border-white/10 bg-[#1a2224] p-5 md:p-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><h2 className="campaign-display text-3xl uppercase leading-none md:text-4xl">{isPos ? "Vertrag in drei Schritten." : "Dein Start in drei Schritten."}</h2><p className="mt-2 text-xs text-white/50">{offerName} · {priceLine}</p></div>
        <p className="campaign-mono shrink-0 text-[10px] uppercase tracking-[0.16em] text-[#FBFF00]">{step} von 3</p>
      </div>
      <div className="mb-6 flex gap-1" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} className={`h-1 flex-1 ${i <= step ? "bg-[#FBFF00]" : "bg-white/10"}`} />)}</div>

      <div className="space-y-3">
        {step > 1 && <DoneCard n={1} title="Kontakt" summary={`${form.firstName} ${form.lastName} · ${form.email}`} onEdit={() => setStep(1)} />}
        {step > 2 && <DoneCard n={2} title="Adresse & Start" summary={`${form.street} ${form.streetNumber}, ${form.zipCode} ${form.city} · Start ${fmtDe(startToday ? today() : form.startDate)}`} onEdit={() => setStep(2)} />}

        {step === 1 && (
          <div ref={stepRef} className="scroll-mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vorname" error={errors.firstName}><Input value={form.firstName} onChange={set("firstName")} onFocus={onFirstFocus} placeholder="Max" autoComplete="given-name" hasError={!!errors.firstName} /></Field>
              <Field label="Nachname" error={errors.lastName}><Input value={form.lastName} onChange={set("lastName")} onFocus={onFirstFocus} placeholder="Muster" autoComplete="family-name" hasError={!!errors.lastName} /></Field>
            </div>
            <Field label="E-Mail" error={errors.email}><Input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} onFocus={onFirstFocus} placeholder="max@beispiel.de" hasError={!!errors.email} /></Field>
            <Field label="Handy" error={errors.phone}><Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} onFocus={onFirstFocus} placeholder="+49 151 …" hasError={!!errors.phone} /></Field>
            <button type="button" onClick={submitStep1} className={btn}>Weiter zu Schritt 2</button>
            {trust}
            {!isPos && contactNote}
          </div>
        )}

        {step === 2 && (
          <div ref={stepRef} className="scroll-mt-4 space-y-4">
            <Field label="Geburtsdatum" error={errors.birthDate === MINOR_TEXT ? undefined : errors.birthDate}><Input type="date" autoComplete="bday" placeholder="TT.MM.JJJJ" value={form.birthDate} onChange={set("birthDate")} min="1920-01-01" max={today()} hasError={!!errors.birthDate} className="campaign-date" />{errors.birthDate === MINOR_TEXT && <MinorNotice offerName={offerName} />}</Field>
            <div className="grid grid-cols-[1fr_88px] gap-3">
              <Field label="Straße" error={errors.street}><Input value={form.street} onChange={set("street")} autoComplete="address-line1" placeholder="Musterstraße" hasError={!!errors.street} /></Field>
              <Field label="Nr." error={errors.streetNumber}><Input value={form.streetNumber} onChange={set("streetNumber")} placeholder="12a" hasError={!!errors.streetNumber} /></Field>
            </div>
            <div className="grid grid-cols-[104px_1fr] gap-3">
              <Field label="PLZ" error={errors.zipCode}><Input inputMode="numeric" autoComplete="postal-code" value={form.zipCode} onChange={v => set("zipCode")(v.replace(/\D/g, "").slice(0, 5))} placeholder="50667" hasError={!!errors.zipCode} /></Field>
              <Field label="Ort" error={errors.city}><Input value={form.city} onChange={set("city")} autoComplete="address-level2" placeholder="Köln" hasError={!!errors.city} /></Field>
            </div>
            {startToday ? <p className="border-l-4 border-[#FBFF00] bg-[#2A3133] px-4 py-3 text-xs leading-relaxed text-white/75">Dein Vertrag startet heute, am Tag des Abschlusses.</p> : (
            <Field label="Startdatum" error={errors.startDate} hint={isPos ? "Heute oder ein Datum deiner Wahl." : "Vorbelegt mit dem nächsten Montag, du kannst es ändern."}><Input type="date" value={form.startDate} onChange={set("startDate")} min={today()} hasError={!!errors.startDate} /></Field>
            )}
            <button type="button" onClick={submitStep2} className={btn}>Weiter zur Zahlung</button>
            {trust}
          </div>
        )}

        {step === 3 && (
          <div ref={stepRef} className="scroll-mt-4 space-y-4">
            {cardAvailable && (
              <div className="grid grid-cols-2 gap-px bg-white/15" role="radiogroup" aria-label="Zahlart">
                {([["sepa", "SEPA-Lastschrift", "IBAN, Abbuchung alle 4 Wochen"], ["card", "Karte · Apple Pay · Google Pay", "Sicher über Stripe"]] as const).map(([k, t, sub]) => { const active = payMethod === k; return (
                  <button key={k} type="button" role="radio" aria-checked={active} onClick={() => { setPayMethod(k); setErrors({}); }} className={`campaign-button flex min-h-[64px] flex-col items-start justify-center p-3 text-left ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white"}`}>
                    <span className="text-xs font-bold uppercase tracking-[0.08em]">{t}</span><span className={`mt-1 text-[11px] ${active ? "text-black/70" : "text-white/55"}`}>{sub}</span>
                  </button>
                ); })}
              </div>
            )}
            {payMethod === "sepa" && <Field label="IBAN" error={errors.iban} hint={ibanOk ? "IBAN geprüft" : "Wird beim Tippen geprüft"}><Input inputMode="text" autoComplete="off" value={form.iban} onChange={onIban} placeholder="DE12 3456 7890 1234 5678 90" hasError={!!errors.iban} ok={ibanOk} /></Field>}
            {payMethod === "sepa" && <Field label="Kontoinhaber" error={errors.accountHolder}><Input value={form.accountHolder} onChange={set("accountHolder")} autoComplete="name" placeholder="Max Muster" hasError={!!errors.accountHolder} /></Field>}
            {summary && summary.length > 0 && (
              <div className="border-l-4 border-[#FBFF00] bg-[#2A3133] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">Zusammenfassung</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">{summary.map(r => <div key={r.label} className="contents"><dt className="text-white/50">{r.label}</dt><dd className="font-bold text-white">{r.value}</dd></div>)}</dl>
              </div>
            )}
            {payMethod === "card" && <p className="border-l-4 border-[#FBFF00] bg-[#2A3133] p-4 text-xs leading-relaxed text-white/70">Nach der Unterschrift geht es zu Stripe. Dort zahlst du das Abo per Karte, Apple Pay oder Google Pay, {priceLine}. Danach kommst du automatisch zurück.</p>}
            <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-white/70">Mit deiner Unterschrift {payMethod === "sepa" ? "erteilst du SKILL CGN das SEPA-Lastschriftmandat für den Beitrag alle vier Wochen von diesem Konto, akzeptierst" : "schließt du den Vertrag ab, zahlst den Beitrag alle vier Wochen per Karte über Stripe, akzeptierst"} die <Link to="/agb" target="_blank" className="underline text-white hover:text-[#FBFF00]">AGB</Link> und die <Link to="/datenschutz" target="_blank" className="underline text-white hover:text-[#FBFF00]">Datenschutzerklärung</Link> und verlangst ausdrücklich, dass SKILL CGN vor Ablauf der 14-tägigen Widerrufsfrist mit der Leistung beginnt. Bei voller Erfüllung erlischt dein Widerrufsrecht, für erbrachte Leistungen kann anteiliger Wertersatz anfallen.</p>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">Unterschrift</p><button type="button" onClick={clearSig} className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white"><Eraser className="h-3 w-3" /> Löschen</button></div>
              <div className={`relative border bg-black ${sigError ? "border-[#FBFF00]" : "border-white/45"}`}>
                <canvas ref={canvasRef} className={`block w-full touch-none ${isPos ? "h-64" : "h-44"}`} aria-label="Unterschriftsfeld" />
                <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-white/35">Mit dem Finger unterschreiben</p>
              </div>
              {sigError && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {sigError}</p>}
              <p className="mt-1.5 text-[11px] text-white/40">Eine Unterschrift für Vertrag und SEPA-Mandat.</p>
            </div>
            {apiError && (
              <div className="border-2 border-[#FBFF00] bg-[#FBFF00]/5 px-4 py-4">
                <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FBFF00]" /><div><p className="text-sm font-bold text-white">Der Vertrag wurde nicht angelegt.</p><p className="mt-1 text-xs leading-relaxed text-white/70">Magicline meldet: {apiError}{apiErrorCustomer ? ` Deine Daten sind als Interessent gespeichert (${apiErrorCustomer}), es wurde nichts abgebucht.` : " Es wurde nichts abgebucht."}</p></div></div>
                {!isPos && <a href={`${WHATSAPP}?text=${encodeURIComponent(`Hi Boris, mein Abschluss ${offerName} auf der Website hat nicht geklappt: ${apiError}`)}`} target="_blank" rel="noopener noreferrer" className="campaign-button mt-3 inline-flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-white">Boris per WhatsApp schreiben</a>}
              </div>
            )}
            {submitHint && <p role="alert" className="flex items-start gap-2 border-l-4 border-[#FBFF00] bg-[#FBFF00]/10 px-3 py-2.5 text-sm font-bold text-[#FBFF00]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> Bitte prüfen: {submitHint}</p>}
            <button type="button" onClick={submit} disabled={pending} className={btn}>{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> {payMethod === "card" ? "Weiter zu Stripe …" : "Wird angelegt …"}</> : payMethod === "card" ? `Weiter zur Kartenzahlung, ${price}\u00a0€` : `Vertrag abschließen für ${price}\u00a0€`}</button>
            <p className="text-center text-[11px] text-white/45">{isPos ? "Erste Abbuchung zum Startdatum. Bestätigung kommt per E-Mail." : cancelNote || (months === 12 ? "12 Monate Laufzeit. Erste Abbuchung zum Startdatum." : "Monatlich kündbar. Erste Abbuchung zum Startdatum.")}</p>
            {trust}
          </div>
        )}
      </div>

      {idle && step >= 2 && !isPos && (
        <p className="mt-5 border-t border-white/10 pt-4 text-xs text-white/55">Hakt etwas? Schreib Boris kurz per <a href={`${WHATSAPP}?text=${encodeURIComponent("Hi Boris, ich hänge beim Start fest.")}`} target="_blank" rel="noopener noreferrer" className="font-bold text-[#FBFF00] underline">WhatsApp</a>.</p>
      )}
      {/* ViewContent, InitiateCheckout, Lead, AddPaymentInfo, Schritt2, Schritt3 feuern hier je einmal pro Sitzung; Purchase auf /danke. */}
    </div>
  );
}
