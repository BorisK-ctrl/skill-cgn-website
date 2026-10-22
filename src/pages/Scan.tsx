/*
 * /scan: Terminseite für den kostenlosen 3D Körperscan. Kein Checkout, kein rate-bundle.
 * Erster Bildschirm (390px): Sterne, Headline, Unterzeile, drei Häkchen, direkt darunter das Formular.
 * Formular: Vorname, Handy, Wunschzeit (Morgens/Mittags/Abends) → Interessent in Magicline über die Connect API
 * (Quelle scan, UTM, Wunschzeit in der Notiz; Magicline verlangt einen Nachnamen, Platzhalter "(Scan-Anfrage)") → /scan/danke.
 * Tracking nur nach Zustimmung, einmal je Sitzung: ViewContent (Scan) beim Laden, Lead (Scan) beim Absenden.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowDown, Check, Loader2, MapPin } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { createLead, WHATSAPP } from "@/lib/magicline";
import { consent, trackOnce, CONSENT_EVENT } from "@/lib/pixel";
import { utmParams } from "@/lib/events";
import { utmSource } from "@/components/StartCheckout";

const LOGO_WHITE = "/img/manus/skill-cgn-original-white_18b77f12.svg";
const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/place/Skill+Cologne/@50.9371,6.9497,17z/data=!4m8!3m7!1s0x47bf259a5f555b25:0xa5bcfa4e61b6fe6!8m2!3d50.9371!4d6.9497!9m1!1b1!16s%2Fg%2F11j2y0ggb8";
const MAPS_URL = "https://maps.google.com/?q=Herzogstra%C3%9Fe+16-20,+50667+K%C3%B6ln";
const Stars = () => <span className="text-[#FBFF00]" aria-hidden="true">★★★★★</span>;
/* Aus reference-site/index.html (Google-Bewertungen der alten Seite) */
const REVIEWS = [
  { quote: "Skill ist für mich die beste Trainingsstätte in Köln. Alles ist tadellos, sauber, mit Liebe zum Detail.", name: "Javier" },
  { quote: "Klasse Gym mit den neuesten Geräten und top Kursen. Erfahrene, motivierte Trainer treffen auf ein sehr angenehmes Publikum.", name: "Google Bewertung" },
] as const;
const FAQ = [
  ["Kostet das wirklich nichts?", "Nein. Der Scan mit Auswertung ist kostenlos. Du bekommst deine Zahlen und ein Gespräch mit dem Coach, mehr nicht."],
  ["Muss ich danach Mitglied werden?", "Nein. Du entscheidest nach dem Scan, ob du bei uns starten willst. Kein Vertrag, kein Druck."],
  ["Was ziehe ich an?", "Enganliegende Sportkleidung, zum Beispiel Shorts und Top oder Leggings. Der Scan braucht die Körperkontur, Schuhe und Socken ziehst du aus."],
] as const;
const TIMES = ["Morgens", "Mittags", "Abends"] as const;
type Time = typeof TIMES[number];
export const SCAN_KEY = "skill-scan";
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";
const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55";

export default function Scan() {
  usePageMeta("Kostenloser 3D Körperscan in Köln, SKILL CGN", "15 Minuten, keine Kosten, keine Verpflichtung. Du siehst, wo du stehst.", "noindex,nofollow");
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState<Time | "">("");
  const [errors, setErrors] = useState<{ firstName?: string; phone?: string; time?: string }>({});
  const [pending, setPending] = useState(false);
  const [apiError, setApiError] = useState("");
  const formRef = useRef<HTMLElement>(null);
  const [formVisible, setFormVisible] = useState(true);

  /* ViewContent (Scan) nur mit Zustimmung, einmal je Sitzung */
  useEffect(() => {
    const fire = () => trackOnce("vc-scan", "ViewContent", { content_name: "Scan", content_category: "Lead", ...utmParams() });
    if (consent() === "accepted") setTimeout(fire, 300);
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 500); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);
  /* Feste Leiste unten nur, solange das Formular nicht im Bild ist */
  useEffect(() => {
    const el = formRef.current; if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const toForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = async () => {
    const e: typeof errors = {};
    if (!firstName.trim()) e.firstName = "Bitte Vornamen eingeben";
    if (phone.replace(/\D/g, "").length < 8) e.phone = "Bitte Handynummer eingeben";
    if (!time) e.time = "Bitte Wunschzeit wählen";
    setErrors(e); if (Object.keys(e).length) return;
    setPending(true); setApiError("");
    const utm = utmParams(); const utmText = Object.entries(utm).filter(([k]) => k.startsWith("utm_")).map(([k, v]) => `${k.replace("utm_", "")}=${v}`).join(" ");
    try {
      /* Magicline verlangt einen Nachnamen; die Seite fragt bewusst nur Vorname und Handy ab */
      const l = await createLead({ firstname: firstName.trim(), lastname: "(Scan-Anfrage)", email: "", phone: phone.trim(), notes: `Scan-Anfrage Website, Quelle: scan${utmText ? ", " + utmText : ""}, Wunschzeit: ${time}, Referrer: ${utmSource()}`.slice(0, 300) });
      if (!l.ok) throw new Error(l.status === 400 ? "Bitte prüfe deine Handynummer" : "Das Mitgliedersystem antwortet gerade nicht");
      trackOnce("lead-scan", "Lead", { content_name: "Scan", content_category: "Lead", ...utmParams() });
      try { sessionStorage.setItem(SCAN_KEY, JSON.stringify({ firstName: firstName.trim(), time, customerNumber: l.customerNumber })); } catch {}
      navigate("/scan/danke");
    } catch (ex: any) { setApiError(String(ex?.message || ex)); } finally { setPending(false); }
  };

  const check = (t: string) => <li key={t} className="flex items-center gap-3 text-sm font-bold text-white/90 md:text-base"><span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-3 w-3 text-black" /></span>{t}</li>;
  return (
    <main className="campaign-page bg-black text-white">
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link to="/" aria-label="SKILL CGN"><img src={LOGO_WHITE} alt="SKILL CGN" className="h-5 w-auto md:h-7" width={160} height={28} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/img/logo-white.svg"; }} /></Link>
          <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="campaign-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/70 hover:text-[#FBFF00]"><Stars /> 4,9 Sterne bei 167 Google Bewertungen</a>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 pb-28 pt-8 md:px-10 lg:grid lg:grid-cols-[1.05fr_0.75fr] lg:gap-16 lg:pb-16 lg:pt-14">
        <div className="min-w-0">
          {/* 1. Erster Bildschirm */}
          <section className="campaign-grid -mx-5 px-5 md:mx-0 md:px-0">
            <h1 className="campaign-display text-[64px] uppercase leading-[0.85] sm:text-[88px] md:text-[112px]">Wo stehst du <span className="text-[#FBFF00]">wirklich.</span></h1>
            <p className="mt-4 text-base leading-relaxed text-white/80 md:text-lg">Kostenloser 3D Körperscan in 15 Minuten. Muskelmasse, Körperfett, Haltung, in Zahlen. Danach dein Plan mit Coach.</p>
            <ul className="mt-5 space-y-2">{["15 Minuten.", "Keine Kosten.", "Keine Verpflichtung."].map(check)}</ul>
          </section>

          {/* 2. Formular direkt darunter, ein Schritt */}
          <section ref={formRef} id="formular" className="mt-6 scroll-mt-4 border border-white/10 bg-[#1a2224] p-5 md:p-7 lg:max-w-2xl">
            <p className={kicker}>Scan Termin</p>
            <h2 className="campaign-display mt-2 text-3xl uppercase leading-none md:text-4xl">Wann passt es dir?</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className={label} htmlFor="scan-first">Vorname</label>
                <input id="scan-first" value={firstName} onChange={e => { setFirstName(e.target.value); setErrors(x => ({ ...x, firstName: undefined })); }} autoComplete="given-name" placeholder="Max" className={`campaign-field min-h-[52px] text-base ${errors.firstName ? "!border-[#FBFF00]" : ""}`} />
                {errors.firstName && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {errors.firstName}</p>}
              </div>
              <div>
                <label className={label} htmlFor="scan-phone">Handy</label>
                <input id="scan-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => { setPhone(e.target.value); setErrors(x => ({ ...x, phone: undefined })); }} placeholder="+49 151 …" className={`campaign-field min-h-[52px] text-base ${errors.phone ? "!border-[#FBFF00]" : ""}`} />
                {errors.phone && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {errors.phone}</p>}
              </div>
              <div>
                <p className={label}>Wunschzeit</p>
                <div className="grid grid-cols-3 gap-px bg-white/15" role="radiogroup" aria-label="Wunschzeit">
                  {TIMES.map(t => { const active = time === t; return (
                    <button key={t} type="button" role="radio" aria-checked={active} onClick={() => { setTime(t); setErrors(x => ({ ...x, time: undefined })); }} className={`campaign-button min-h-[52px] text-sm font-bold uppercase tracking-[0.1em] ${active ? "bg-[#FBFF00] text-black" : "bg-[#2A3133] text-white hover:bg-[#33403f]"}`}>{t}</button>
                  ); })}
                </div>
                {errors.time && <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#FBFF00]"><AlertCircle className="h-3 w-3" /> {errors.time}</p>}
              </div>
              {apiError && (
                <div className="border-2 border-[#FBFF00] bg-[#FBFF00]/5 px-4 py-4">
                  <p className="text-sm font-bold text-white">Das hat nicht geklappt.</p><p className="mt-1 text-xs leading-relaxed text-white/70">{apiError}. Schreib uns einfach direkt.</p>
                  <a href={`${WHATSAPP}?text=${encodeURIComponent(`Hi Boris, ich möchte einen Scan-Termin, ${firstName.trim()}, am liebsten ${time || "flexibel"}.`)}`} target="_blank" rel="noopener noreferrer" className="campaign-button mt-3 inline-flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-white">Per WhatsApp anfragen</a>
                </div>
              )}
              <button type="button" onClick={submit} disabled={pending} className="campaign-button flex min-h-14 w-full items-center justify-center gap-2 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white disabled:opacity-60">{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gesendet …</> : "Scan Termin anfragen"}</button>
              <p className="text-center text-[11px] text-white/45">Boris meldet sich per WhatsApp mit Terminvorschlägen. <Link to="/datenschutz" target="_blank" className="underline hover:text-white">Datenschutz</Link></p>
            </div>
          </section>

          {/* 6. Darunter: Bild, drei Sätze, Bewertungen, Adresse, FAQ */}
          <section className="mt-10 lg:max-w-2xl">
            <div className="grid gap-5 sm:grid-cols-[200px_1fr] sm:items-center">
              <img src="/img/scan-scaneca.jpg" alt="3D Körperscan mit Umfängen in Zentimetern" width={943} height={1400} loading="lazy" decoding="async" className="w-full max-w-[220px] border border-white/10 sm:max-w-none" />
              <div>
                <p className={kicker}>Was du bekommst</p>
                <h2 className="campaign-display mt-2 text-4xl uppercase leading-[0.9] md:text-5xl">Zahlen statt Gefühl.</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/75 md:text-base">Der Scaneca 3D Scan misst dich in 15 Minuten von Kopf bis Fuß: Muskelmasse, Körperfett, Umfänge und Haltung. Du bekommst die Auswertung ausgedruckt und erklärt. Daraus macht dein Coach einen Plan, der zu deinem Startpunkt passt.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-px bg-white/15 sm:grid-cols-2">
              {REVIEWS.map(r => <div key={r.name} className="bg-[#2A3133] px-4 py-4"><p className="text-sm font-bold leading-snug text-white">„{r.quote}“</p><p className="campaign-mono mt-2 text-[9px] uppercase tracking-[0.2em] text-white/60"><Stars /> {r.name} · Google</p></div>)}
            </div>
            <div className="mt-6 flex items-start gap-3 border border-white/10 bg-[#1a2224] p-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#FBFF00]" />
              <div><p className="text-sm font-bold text-white">SKILL CGN, Herzogstraße 16 bis 20, 50667 Köln</p><p className="mt-1 text-xs text-white/60">Zwei Minuten vom Neumarkt. <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[#FBFF00] underline">Route in Google Maps</a></p></div>
            </div>
            <div className="mt-8">
              <p className={kicker}>Fragen</p>
              <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                {FAQ.map(([q, a]) => <details key={q} className="group py-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold uppercase tracking-[0.08em] text-white">{q}<span className="text-[#FBFF00] group-open:rotate-45 transition-transform">+</span></summary><p className="mt-2 text-sm leading-relaxed text-white/70">{a}</p></details>)}
              </div>
            </div>
          </section>
        </div>
        <aside className="hidden lg:block"><div className="sticky top-8"><img src="/img/scan-scaneca.jpg" alt="" width={943} height={1400} loading="lazy" decoding="async" className="w-full max-w-md border border-white/10" /><p className="campaign-display mt-5 text-5xl uppercase leading-none text-white/85">Show up.<br /><span className="text-[#FBFF00]">Earn it.</span></p></div></aside>
      </div>

      {/* Feste Leiste unten (mobil), bis das Formular im Bild ist */}
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#FBFF00] bg-black transition-transform duration-200 md:hidden ${formVisible ? "translate-y-full" : "translate-y-0"}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-hidden={formVisible}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="campaign-mono text-[10px] uppercase tracking-[0.16em] text-white">Scan gratis, 15 Minuten</p>
          <button type="button" onClick={toForm} tabIndex={formVisible ? -1 : 0} className="campaign-button flex min-h-11 items-center gap-2 bg-[#FBFF00] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black">Termin anfragen <ArrowDown className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </main>
  );
}
