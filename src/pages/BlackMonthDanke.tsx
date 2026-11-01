/*
 * /blackmonth/danke: Ziel des Stripe Payment Links (…/blackmonth/danke?session_id={CHECKOUT_SESSION_ID}).
 * Kauf-Event genau hier: Google Ads Conversion (Wert 149, transaction_id = Stripe-Sitzung) sofort, Meta Purchase (Pixel 577923356905873)
 * nur mit Zustimmung, event_id = Stripe-Sitzung (Dedup mit der Conversions API aus dem Webhook). Je Sitzung nur einmal.
 * Buchungslink aus VITE_BOOKING_URL, solange leer der WhatsApp-Hinweis an Boris.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Check, MessageCircle } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { consent, CONSENT_EVENT, track } from "@/lib/pixel";
import { gadsConversion } from "@/lib/gads";
import { BLACK_MONTH } from "./BlackMonth";

const BOOKING_URL = (import.meta.env.VITE_BOOKING_URL || "").trim();
const WA_BORIS = "https://wa.me/4915141277708";
const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";

export default function BlackMonthDanke() {
  usePageMeta("Du bist dabei — Black Month bei SKILL CGN", "Deine Zahlung ist angekommen.", "noindex,nofollow");
  const [params] = useSearchParams();
  const sessionId = (params.get("session_id") || "").slice(0, 80);
  // Referenz erst nach dem Mount zeigen: der Prerender kennt keine Query, sonst Hydration-Fehler.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const id = sessionId || "blackmonth_" + new Date().toISOString().slice(0, 10);
    gadsConversion({ value: BLACK_MONTH.price, currency: "EUR", transactionId: id });
    let fired = false;
    const fire = () => {
      if (fired) return; fired = true;
      const key = "skill-bm-purchase-" + id;
      try { if (sessionStorage.getItem(key)) return; } catch {}
      let tries = 0;
      const send = () => {
        if (window.fbq) { track("Purchase", { value: BLACK_MONTH.price, currency: "EUR", content_name: "Black Month", content_type: "product" }, { eventID: id }); try { sessionStorage.setItem(key, "1"); } catch {} }
        else if (++tries < 20) setTimeout(send, 300);
      };
      send();
    };
    if (consent() === "accepted") setTimeout(fire, 300);
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 500); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [sessionId]);

  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-5 py-16 md:py-24">
        <div className="flex h-16 w-16 items-center justify-center bg-[#FBFF00]"><Check className="h-8 w-8 text-black" /></div>
        <p className={`${kicker} mt-8`}>Black Month</p>
        <h1 className="campaign-display mt-3 text-6xl uppercase leading-[0.85] md:text-8xl">Du bist<br /><span className="text-[#FBFF00]">dabei.</span></h1>
        <p className="mt-6 text-lg leading-relaxed text-white/80">Deine Zahlung über 149 € ist angekommen. Sechs Monate Gym bei SKILL CGN, ab deinem ersten Trainingstag. Start bis spätestens 15.12.2026. Die Bestätigung mit allen Details ist auf dem Weg in dein Postfach.</p>
        {mounted && sessionId && <p className="campaign-mono mt-3 text-[10px] uppercase tracking-[0.16em] text-white/40">Zahlungsreferenz {sessionId.slice(-12)}</p>}
        <div className="mt-10 border-2 border-[#FBFF00] bg-[#1a2224] p-6">
          <p className="text-sm font-bold uppercase tracking-[0.12em]">Nächster Schritt: dein Starttermin</p>
          {BOOKING_URL ? (
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="campaign-button mt-4 inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white"><CalendarDays className="h-4 w-4" /> Starttermin wählen</a>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-white/75">Schreib Boris per WhatsApp an 0151 41277708 mit deinem Wunschtag.</p>
          )}
          <a href={`${WA_BORIS}?text=${encodeURIComponent("Hi Boris, ich habe Black Month gebucht. Mein Wunschtag für den Start: ")}`} target="_blank" rel="noopener noreferrer" className={`campaign-button mt-3 inline-flex min-h-14 w-full items-center justify-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] ${BOOKING_URL ? "border-2 border-white/30 text-white hover:border-[#FBFF00] hover:text-[#FBFF00]" : "bg-[#FBFF00] text-black hover:bg-white"}`}><MessageCircle className="h-4 w-4" /> WhatsApp an Boris</a>
        </div>
        <div className="mt-8 space-y-2 text-sm text-white/65">
          <p><strong className="text-white">Mitbringen:</strong> Sportsachen, saubere Hallenschuhe, Handtuch.</p>
          <p><strong className="text-white">Adresse:</strong> SKILL CGN, Herzogstraße 16, 50667 Köln, zwei Minuten vom Neumarkt.</p>
          <p>Die Rechnung kommt separat von Stripe. AGB und Widerruf: <Link to="/agb" className="underline text-[#FBFF00]">skill-studios.com/agb</Link></p>
        </div>
      </div>
    </main>
  );
}
