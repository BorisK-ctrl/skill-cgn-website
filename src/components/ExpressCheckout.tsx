/*
 * Express-Abschluss auf /start39 und /back39: Apple Pay, Google Pay oder Link direkt auf der Seite (Stripe Express Checkout Element).
 * Die Wallet liefert Name, E-Mail, Telefon und Adresse; hier fehlen nur Geburtsdatum, Unterschrift und die zwei Kästchen (AGB, Widerruf).
 * Fehlt nach der Wallet-Freigabe ein Pflichtfeld, schließt das Sheet, ein kurzes Formular fragt nur das Fehlende nach (vorhandenes vorbefüllt),
 * danach noch einmal auf den Wallet-Knopf. Der Vertrag entsteht erst, wenn alle Magicline-Pflichtdaten da sind.
 * Ablauf: Wallet-Knopf → Sheet → confirm → /api/stripe/express subscribe (Interessent + Stripe-Abo) → stripe.confirmPayment
 * → /api/stripe/express complete (Magicline-Vertrag, Zahlart Überweisung, Stripe zieht ein) → /danke (Purchase mit Vertragsnummer).
 * Ohne Wallet auf dem Gerät bleibt der Block unsichtbar, das Formular darunter gilt. Stripe.js wird erst hier geladen, nicht im Bundle.
 * Element im Modus "payment" + setupFutureUsage: im Modus "subscription" meldet Stripe auf diesem Konto keine Wallets (getestet 27.09.2026).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, Eraser, Loader2, Zap } from "lucide-react";
import { WHATSAPP, type RateBundleTerm } from "@/lib/magicline";
import { consent, trackOnce, trackCustom, trackCustomOnce } from "@/lib/pixel";
import { utmParams } from "@/lib/events";
import { expressAvailable, loadStripe } from "@/lib/stripe";
import { useSignaturePad } from "@/lib/signature";
import { nextMonday, utmSource, MINOR_TEXT, MinorNotice } from "@/components/StartCheckout";

const cookie = (n: string) => { try { return document.cookie.split("; ").find(c => c.startsWith(n + "="))?.split("=")[1] || ""; } catch { return ""; } };
const newToken = () => { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(24))) s += a[x % a.length]; return s; };
const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
type Status = "loading" | "none" | "ready" | "pending" | "error";
/** Pflichtdaten für Magicline; die Wallet liefert meist alles, jedes Feld kann aber fehlen. */
type Person = { firstName: string; lastName: string; email: string; phone: string; street: string; streetNumber: string; zip: string; city: string };
type PKey = keyof Person;
const LABELS: Record<PKey, string> = { firstName: "Vorname", lastName: "Nachname", email: "E-Mail", phone: "Handy", street: "Straße", streetNumber: "Nr.", zip: "PLZ", city: "Ort" };
const empty = (): Person => ({ firstName: "", lastName: "", email: "", phone: "", street: "", streetNumber: "", zip: "", city: "" });
/** "Herzogstraße 16-20" → Straße + Nummer. Ohne Nummer bleibt sie leer und wird nachgefragt. */
export function splitStreet(line1: string, line2 = ""): { street: string; streetNumber: string } {
  const m = line1.trim().match(/^(.*?)[\s,]+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+\s?[a-zA-Z]?)?)$/);
  if (m) return { street: m[1].trim(), streetNumber: m[2].replace(/\s+/g, "") };
  return { street: line1.trim(), streetNumber: /^\d+\s?[a-zA-Z]?$/.test(line2.trim()) ? line2.trim() : "" };
}
/** Wallet-Daten in unsere Felder; Name mit nur einem Wort zählt als fehlender Nachname. */
function fromWallet(bd: any): Person {
  const parts = String(bd?.name || "").trim().split(/\s+/).filter(Boolean);
  const a = bd?.address || {};
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" "), email: String(bd?.email || "").trim(), phone: String(bd?.phone || "").trim(), ...splitStreet(String(a.line1 || ""), String(a.line2 || "")), zip: String(a.postal_code || "").trim(), city: String(a.city || "").trim() };
}
function missingKeys(p: Person): PKey[] {
  const m: PKey[] = [];
  if (!p.firstName.trim()) m.push("firstName"); if (!p.lastName.trim()) m.push("lastName");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(p.email.trim())) m.push("email");
  if (p.phone.replace(/\D/g, "").length < 8) m.push("phone");
  if (!p.street.trim()) m.push("street"); if (!p.streetNumber.trim()) m.push("streetNumber");
  if (!/^\d{5}$/.test(p.zip.trim())) m.push("zip"); if (!p.city.trim()) m.push("city");
  return m;
}

export default function ExpressCheckout({ term, offerName, path, priceLine, months }: { term: RateBundleTerm | null; offerName: string; path: "/start39" | "/back39" | "/checkout"; priceLine: string; months?: 1 | 12 }) {
  const navigate = useNavigate();
  const price = term?.price ?? 39;
  const [status, setStatus] = useState<Status>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [birthDate, setBirthDate] = useState("1990-01-01");
  const [dobError, setDobError] = useState("");
  const [minor, setMinor] = useState(false);
  const [sigError, setSigError] = useState("");
  const [agb, setAgb] = useState(false); const [widerruf, setWiderruf] = useState(false); const [legalError, setLegalError] = useState("");
  /* Nachfrage: Felder, die die Wallet nicht geliefert hat; Werte aus der Wallet vorbefüllt */
  const [fill, setFill] = useState<Person>(empty);
  const [missing, setMissing] = useState<PKey[]>([]);
  const [fillError, setFillError] = useState("");
  /* Pflichtfelder vor dem Wallet-Knopf: Name, E-Mail und Handy kommen immer aus dem Formular, nie nur aus der Wallet */
  const [who, setWho] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [whoError, setWhoError] = useState<Partial<Record<"firstName" | "lastName" | "email" | "phone", string>>>({});
  const sig = useSignaturePad(status !== "loading" && status !== "none", () => setSigError(""));
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef({ birthDate, term, agb, widerruf, fill, missing, who }); live.current = { birthDate, term, agb, widerruf, fill, missing, who };
  const enabled = expressAvailable(offerName);
  const dbg = (m: string, d?: unknown) => { try { ((window as any).__skillExpress ||= []).push([new Date().toISOString().slice(11, 23), m, d ?? null]); } catch {} };
  /* Diagnose ins Protokoll (Netlify Blobs checkout-log): welche Wallets Stripe auf dem Gerät meldet, Ladefehler. Scheitert still. */
  const beacon = (stage: string, data: Record<string, unknown>) => { dbg(stage, data); fetch("/api/checkout-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign: offerName, stage, request: { ...data, ua: navigator.userAgent.slice(0, 160), applePaySession: !!(window as any).ApplePaySession, canMakePayments: (() => { try { return (window as any).ApplePaySession?.canMakePayments?.() ?? null; } catch { return "err"; } })() } }), keepalive: true }).catch(() => {}); };

  /* Vor dem Sheet: Alter, Unterschrift, Kästchen, nachgefragte Felder. Ohne resolve() öffnet das Sheet nicht, die Fehler stehen am Feld. */
  const validate = () => {
    const c = live.current; let ok = true;
    const we: typeof whoError = {};
    if (!c.who.firstName.trim()) we.firstName = "Bitte Vornamen eingeben";
    if (!c.who.lastName.trim()) we.lastName = "Bitte Nachnamen eingeben";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(c.who.email.trim())) we.email = "Bitte gültige E-Mail eingeben";
    if (c.who.phone.replace(/\D/g, "").length < 8) we.phone = "Bitte Handynummer eingeben";
    setWhoError(we); if (Object.keys(we).length) ok = false;
    if (!c.birthDate) { setDobError("Bitte Geburtsdatum eingeben"); ok = false; }
    else if ((Date.now() - new Date(c.birthDate).getTime()) / 31557600000 < 18) { setDobError(MINOR_TEXT); setMinor(true); ok = false; }
    else { setDobError(""); setMinor(false); }
    if (!sig.hasStrokes()) { setSigError("Bitte unterschreibe im Feld"); ok = false; }
    if (!c.agb || !c.widerruf) { setLegalError("Bitte AGB und Widerrufsbelehrung bestätigen"); ok = false; } else setLegalError("");
    if (c.missing.length) { const still = missingKeys(c.fill).filter(k => c.missing.includes(k)); if (still.length) { setFillError(`Bitte ausfüllen: ${still.map(k => LABELS[k]).join(", ")}`); ok = false; } else setFillError(""); }
    if (!c.term) { setErrMsg("Das Angebot ist gerade nicht erreichbar. Bitte lade die Seite neu."); ok = false; }
    return ok;
  };

  useEffect(() => {
    if (!enabled || !term) { dbg("effect-skip", { enabled, term: !!term }); return; }
    let ece: any = null; let cancelled = false; dbg("effect-start");
    loadStripe().then(stripe => {
      dbg("stripe-loaded", { stripe: !!stripe, mount: !!mountRef.current, cancelled });
      if (!stripe || cancelled || !mountRef.current) { setStatus("none"); beacon("express-none", { reason: !stripe ? "kein Stripe" : cancelled ? "abgebrochen" : "kein Mount" }); return; }
      const elements = stripe.elements({ mode: "payment", amount: Math.round(price * 100), currency: "eur", setupFutureUsage: "off_session", appearance: { theme: "night", variables: { borderRadius: "0", colorPrimary: "#FBFF00" } } });
      ece = elements.create("expressCheckout", {
        buttonType: { applePay: "subscribe", googlePay: "subscribe" }, buttonTheme: { applePay: "white", googlePay: "white" }, buttonHeight: 55,
        layout: { maxColumns: 1, maxRows: 3 } /* nicht mit overflow "never" kombinieren: dann meldet das Element nie "ready" (getestet 2026-09-27) */,
        paymentMethods: { applePay: "always", googlePay: "always", link: "auto", paypal: "never", amazonPay: "never", klarna: "never" },
      });
      ece.on("ready", (e: any) => { const pm = e?.availablePaymentMethods; const ok = !!(pm && (pm.applePay || pm.googlePay || pm.link)); setStatus(ok ? "ready" : "none"); beacon(ok ? "express-ready" : "express-none", { pm: pm || null }); });
      ece.on("loaderror", (e: any) => { setStatus("none"); beacon("express-loaderror", { error: String(e?.error?.message || e?.error || "").slice(0, 300) }); });
      ece.on("click", (event: any) => {
        if (!validate()) return;
        setErrMsg("");
        trackOnce("ic-" + path, "InitiateCheckout", { content_name: offerName, content_category: "Membership", value: price, currency: "EUR", payment: "express", ...utmParams() });
        trackCustomOnce("express-" + path, "ExpressClick", { content_name: offerName, wallet: event?.expressPaymentType || "" });
        event.resolve({ emailRequired: false, phoneNumberRequired: false, billingAddressRequired: true, business: { name: "SKILL CGN" } });
      });
      ece.on("confirm", async (event: any) => {
        setStatus("pending"); setErrMsg("");
        const c = live.current; const t = c.term!;
        /* Wallet-Daten plus nachgefragte Felder; fehlt noch etwas, Sheet schließen und nachfragen */
        const w = fromWallet(event?.billingDetails);
        /* Name, E-Mail, Handy aus den Pflichtfeldern (haben Vorrang), Adresse aus der Wallet, Rest aus der Nachfrage */
        const person: Person = { ...w, firstName: c.who.firstName.trim(), lastName: c.who.lastName.trim(), email: c.who.email.trim(), phone: c.who.phone.trim() };
        for (const k of c.missing) if (c.fill[k]?.trim()) person[k] = c.fill[k].trim();
        const gaps = missingKeys(person);
        if (gaps.length) {
          try { event.paymentFailed({ reason: "fail" }); } catch {}
          setFill(f => { const n = { ...f }; for (const k of Object.keys(person) as PKey[]) if (!n[k]) n[k] = person[k]; return n; });
          setMissing(gaps); setFillError(""); setStatus("ready"); beacon("express-missing", { gaps, wallet: event?.expressPaymentType || "" });
          return;
        }
        const tok = newToken(); let confirmed = false;
        try {
          const { error: submitError } = await elements.submit(); if (submitError) throw new Error(submitError.message || "Eingabe unvollständig");
          const r = await fetch("/api/stripe/express", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", token: tok, path, offerName, months, rateBundleTermId: t.id, startDate: nextMonday(), dob: c.birthDate, signatureSvgBase64: sig.svgBase64(),
            ...person, houseNumber: person.streetNumber, wallet: event?.expressPaymentType || "", price: t.price, utm: utmSource(true), sourceUrl: location.href, consent: consent(), fbp: cookie("_fbp"), fbc: cookie("_fbc") || (utmParams().fbclid ? `fb.1.${Date.now()}.${utmParams().fbclid}` : "") }) });
          const j = await r.json().catch(() => ({}));
          if (r.status === 400 && Array.isArray(j.missing) && j.missing.length) { try { event.paymentFailed({ reason: "fail" }); } catch {} setFill(f => ({ ...f, ...person })); setMissing(j.missing); setStatus("ready"); return; }
          if (!r.ok || !j.clientSecret) throw new Error(j.error || "Der Abschluss konnte nicht vorbereitet werden");
          trackOnce("lead-" + path, "Lead", { content_name: offerName, content_category: "Membership", value: price, currency: "EUR", ...utmParams() });
          trackOnce("payment-" + path, "AddPaymentInfo", { content_name: offerName, value: price, currency: "EUR", payment: "express", ...utmParams() });
          try { sessionStorage.setItem("skill-contract-pending", JSON.stringify({ token: tok, offer: offerName, name: person.firstName, start: nextMonday(), price: t.price, express: true })); } catch {}
          confirmed = true;
          const { error } = await stripe.confirmPayment({ elements, clientSecret: j.clientSecret, confirmParams: { return_url: `${location.origin}/danke?express=${tok}` }, redirect: "if_required" });
          if (error) throw new Error(error.message || "Zahlung nicht bestätigt");
          /* Bezahlt: Vertrag anlegen. Dauert es länger, wartet /danke weiter (fragt dieselbe Aktion erneut ab). */
          const cr = await fetch("/api/stripe/express", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", token: tok }) });
          const cj = await cr.json().catch(() => ({}));
          if (cj.done && cj.contractId) {
            try { sessionStorage.setItem("skill-contract", JSON.stringify({ offer: offerName, cid: cj.contractId, customer: cj.customerNumber, name: person.firstName, start: nextMonday(), price: t.price, payment: "express", t: tok })); sessionStorage.removeItem("skill-contract-pending"); } catch {}
            navigate(`/danke?offer=${encodeURIComponent(offerName)}&vertrag=${encodeURIComponent(cj.contractId)}`);
          } else navigate(`/danke?express=${tok}`);
        } catch (ex: any) {
          if (!confirmed) { try { event.paymentFailed({ reason: "fail" }); } catch {} }
          setErrMsg(String(ex?.message || ex)); setStatus("error"); trackCustom("CheckoutError", { content_name: offerName, payment: "express" });
        }
      });
      ece.mount(mountRef.current); dbg("mounted");
    }).catch((e: any) => { setStatus("none"); beacon("express-stripejs-fail", { error: String(e?.message || e).slice(0, 300) }); });
    return () => { cancelled = true; dbg("effect-cleanup", { hadElement: !!ece }); try { ece?.destroy(); } catch {} };
  }, [enabled, !!term]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null;
  const visible = status !== "loading" && status !== "none";
  const startLabel = new Date(nextMonday() + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" });
  const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-white/55";
  const box = (checked: boolean, on: () => void, text: React.ReactNode) => (
    <button type="button" role="checkbox" aria-checked={checked} onClick={on} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${checked ? "border-[#FBFF00] bg-[#FBFF00] text-black" : "border-white/45 bg-black"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
      <span className="text-xs leading-relaxed text-white/75">{text}</span>
    </button>
  );
  return (
    /* Bis Stripe "ready" meldet, liegt der Block unsichtbar außerhalb des Bildschirms, aber mit echter Breite: in einem Container mit Höhe 0 rendert das Element nicht fertig und meldet nie, welche Wallets verfügbar sind. */
    <div className={visible ? "mb-3" : "pointer-events-none absolute -left-[9999px] top-0 w-[640px] max-w-[92vw] opacity-0"} aria-hidden={!visible}>
      <div className="border-2 border-[#FBFF00] bg-[#1a2224] p-5 md:p-7">
        <p className="campaign-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]"><Zap className="h-3.5 w-3.5" /> Express-Abschluss</p>
        <h2 className="campaign-display mt-2 text-3xl uppercase leading-none md:text-4xl">In einer Minute Mitglied.</h2>
        <p className="mt-2 text-xs text-white/50">{offerName} · {priceLine}</p>
        <p className="mt-4 text-sm leading-relaxed text-white/70">Name, E-Mail und Handy trägst du hier ein, die Adresse kommt aus der Wallet. Dazu Geburtsdatum und Unterschrift.</p>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {([["firstName", "Vorname", "given-name", "text"], ["lastName", "Nachname", "family-name", "text"], ["email", "E-Mail", "email", "email"], ["phone", "Handy", "tel", "tel"]] as const).map(([k, l, ac, type]) => (
              <div key={k} className={k === "email" || k === "phone" ? "col-span-2 sm:col-span-1" : ""}>
                <label className={`mb-1.5 block ${label}`} htmlFor={`express-who-${k}`}>{l}</label>
                <input id={`express-who-${k}`} type={type} inputMode={k === "phone" ? "tel" : k === "email" ? "email" : "text"} autoComplete={ac} required value={who[k]} onChange={e => { setWho(w => ({ ...w, [k]: e.target.value })); setWhoError(er => ({ ...er, [k]: undefined })); }} className={`campaign-field min-h-[48px] text-base ${whoError[k] ? "!border-[#FBFF00]" : ""}`} />
                {whoError[k] && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {whoError[k]}</p>}
              </div>
            ))}
          </div>
          <div>
            <label className={`mb-1.5 block ${label}`} htmlFor="express-dob">Geburtsdatum</label>
            <input id="express-dob" type="date" autoComplete="bday" placeholder="TT.MM.JJJJ" value={birthDate} min="1920-01-01" max={today()} onChange={e => { setBirthDate(e.target.value); setDobError(""); setMinor(false); }} className={`campaign-field campaign-date min-h-[52px] text-base ${dobError ? "!border-[#FBFF00]" : ""}`} />
            {dobError && !minor && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {dobError}</p>}
            {minor && <MinorNotice offerName={offerName} />}
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><p className={label}>Unterschrift</p><button type="button" onClick={sig.clear} className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white"><Eraser className="h-3 w-3" /> Löschen</button></div>
            <div className={`relative border bg-black ${sigError ? "border-[#FBFF00]" : "border-white/45"}`}>
              <canvas ref={sig.canvasRef} className="block h-36 w-full touch-none" aria-label="Unterschriftsfeld" />
              <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-white/35">Mit dem Finger unterschreiben</p>
            </div>
            {sigError && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {sigError}</p>}
          </div>

          {missing.length > 0 && (
            <div className="border border-[#FBFF00] bg-[#2A3133] p-4">
              <p className="text-sm font-bold text-white">Deine Wallet hat nicht alles geliefert.</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">Ergänze bitte {missing.map(k => LABELS[k]).join(", ")} und tippe dann noch einmal auf den Bezahl-Knopf.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {missing.map(k => (
                  <div key={k} className={k === "email" || k === "street" ? "col-span-2" : ""}>
                    <label className={`mb-1.5 block ${label}`} htmlFor={`express-${k}`}>{LABELS[k]}</label>
                    <input id={`express-${k}`} type={k === "email" ? "email" : k === "phone" ? "tel" : "text"} inputMode={k === "zip" ? "numeric" : k === "phone" ? "tel" : k === "email" ? "email" : "text"} value={fill[k]} onChange={e => { setFill(f => ({ ...f, [k]: k === "zip" ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value })); setFillError(""); }} className="campaign-field min-h-[48px] text-base" />
                  </div>
                ))}
              </div>
              {fillError && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {fillError}</p>}
            </div>
          )}

          <div className="space-y-3 border-t border-white/10 pt-4">
            {box(agb, () => { setAgb(v => !v); setLegalError(""); }, <>Ich akzeptiere die <Link to="/agb" target="_blank" className="underline text-white hover:text-[#FBFF00]">AGB</Link> und habe die <Link to="/datenschutz" target="_blank" className="underline text-white hover:text-[#FBFF00]">Datenschutzerklärung</Link> gelesen.</>)}
            {box(widerruf, () => { setWiderruf(v => !v); setLegalError(""); }, <>Ich habe die <Link to="/agb#widerruf" target="_blank" className="underline text-white hover:text-[#FBFF00]">Widerrufsbelehrung</Link> gelesen und verlange ausdrücklich, dass SKILL CGN vor Ablauf der 14-tägigen Widerrufsfrist mit der Leistung beginnt. Bei voller Erfüllung erlischt mein Widerrufsrecht, für erbrachte Leistungen kann anteiliger Wertersatz anfallen.</>)}
            {legalError && <p className="flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {legalError}</p>}
          </div>
          {errMsg && (
            <div className="border-2 border-[#FBFF00] bg-[#FBFF00]/5 px-4 py-4">
              <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FBFF00]" /><div><p className="text-sm font-bold text-white">Das hat nicht geklappt.</p><p className="mt-1 text-xs leading-relaxed text-white/70">{errMsg} Du kannst es noch einmal versuchen oder unten das Formular nutzen.</p></div></div>
              <a href={`${WHATSAPP}?text=${encodeURIComponent(`Hi Boris, mein Express-Abschluss ${offerName} hat nicht geklappt: ${errMsg}`)}`} target="_blank" rel="noopener noreferrer" className="campaign-button mt-3 inline-flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-white">Boris per WhatsApp schreiben</a>
            </div>
          )}
          {/* §312j BGB: Der Wallet-Knopf ist nicht beschriftbar, deshalb steht die Zahlungspflicht direkt darüber. Startdatum immer der nächste Montag nach dem Abschluss (nextMonday), dasselbe Datum geht als Vertragsbeginn an Magicline. */}
          <div>
            <p className="mb-2 text-center text-xs leading-relaxed text-white/70">Erste Zahlung von {price} € sofort, deine Mitgliedschaft beginnt am Montag, {startLabel}.</p>
            <p className="mb-2 text-center text-sm font-bold uppercase tracking-[0.1em] text-white">Zahlungspflichtig abschließen, {price} € alle vier Wochen</p>
            <div className="relative">
              <div ref={mountRef} className={status === "pending" ? "pointer-events-none opacity-40" : ""} />
              {status === "pending" && <p className="campaign-mono absolute inset-x-0 top-full mt-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#FBFF00]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Vertrag wird angelegt …</p>}
            </div>
          </div>
          <p className={`text-center text-[11px] text-white/45 ${status === "pending" ? "pt-5" : ""}`}>Danach {price} € alle vier Wochen, monatlich kündbar.</p>
        </div>
      </div>
      <p className="campaign-mono mt-4 mb-1 text-center text-[10px] uppercase tracking-[0.18em] text-white/40">Oder mit dem Formular: SEPA-Lastschrift oder Karte</p>
    </div>
  );
}
