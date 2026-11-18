/*
 * /blackweek/danke: Ziel nach dem Black-Week-Abschluss (StartCheckout navigiert mit ?vertrag=<Vertragsnummer>).
 * Kauf-Event genau hier: Google Ads Conversion "Kauf" sofort (Consent Mode v2), Meta Purchase (value 29, EUR, content_name "ONLY GYM 29")
 * nur mit Zustimmung. Beide mit der Vertragsnummer als ID, je Vertrag nur einmal (sessionStorage), Dedup mit der Conversions API aus checkout-lead.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, MessageCircle } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { consent, CONSENT_EVENT, track } from "@/lib/pixel";
import { gadsConversion } from "@/lib/gads";
import { utmParams } from "@/lib/events";
import { WHATSAPP } from "@/lib/magicline";
import { BLACK_WEEK } from "@/lib/blackweek";

const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";

export default function BlackWeekDanke() {
  usePageMeta("Du bist drin — Black Week bei SKILL CGN", "Dein Vertrag ist angelegt.", "noindex,nofollow");
  const [params] = useSearchParams();
  /* Vertrag aus dem Abschluss (sessionStorage), sonst aus der URL */
  const [c, setC] = useState<{ cid: string; name: string; price: number } | null>(null);
  useEffect(() => {
    let s: any = null; try { s = JSON.parse(sessionStorage.getItem("skill-contract") || "null"); } catch {}
    const cid = String(s?.cid || params.get("vertrag") || "").slice(0, 40);
    if (cid) setC({ cid, name: s?.name || "", price: typeof s?.price === "number" && s.price > 0 ? s.price : BLACK_WEEK.price });
  }, [params]);

  useEffect(() => {
    if (!c) return;
    gadsConversion({ value: c.price, currency: "EUR", transactionId: c.cid });
    let fired = false;
    const fire = () => {
      if (fired) return; fired = true;
      const key = "skill-meta-purchase-" + c.cid;
      try { if (sessionStorage.getItem(key)) return; } catch {}
      let tries = 0;
      const send = () => {
        if (window.fbq) { track("Purchase", { value: c.price, currency: "EUR", content_name: BLACK_WEEK.pixelName, content_type: "product", ...utmParams() }, { eventID: c.cid }); try { sessionStorage.setItem(key, "1"); } catch {} }
        else if (++tries < 20) setTimeout(send, 300);
      };
      send();
    };
    if (consent() === "accepted") setTimeout(fire, 300);
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 500); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [c]);

  const wa = `${WHATSAPP}?text=${encodeURIComponent("Hi, ich habe gerade Gym Only 29 gebucht, wann passt der Scan?")}`;
  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-5 py-16 md:py-24">
        <div className="flex h-16 w-16 items-center justify-center bg-[#FBFF00]"><Check className="h-8 w-8 text-black" /></div>
        <p className={`${kicker} mt-8`}>Black Week · Gym Only</p>
        <h1 className="campaign-display mt-3 text-6xl uppercase leading-[0.85] md:text-8xl">Du bist<br /><span className="text-[#FBFF00]">drin.</span></h1>
        <p className="mt-6 text-lg leading-relaxed text-white/80">{c?.name ? `${c.name}, dein` : "Dein"} Vertrag ist angelegt. Die Bestätigung kommt per Mail.</p>
        {c?.cid && <p className="campaign-mono mt-3 text-[10px] uppercase tracking-[0.16em] text-white/40">Vertragsnummer {c.cid}</p>}
        <div className="mt-10 border-2 border-[#FBFF00] bg-[#1a2224] p-6">
          <p className="text-sm font-bold uppercase tracking-[0.12em]">Nächster Schritt: Scan und Assessment</p>
          <p className="mt-3 text-sm leading-relaxed text-white/75">Boris meldet sich innerhalb von 24 Stunden per WhatsApp für deinen Termin zu Scan und Assessment. Oder du schreibst direkt:</p>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="campaign-button mt-4 inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white"><MessageCircle className="h-4 w-4" /> WhatsApp an Boris</a>
        </div>
        <div className="mt-8 space-y-2 text-sm text-white/65">
          <p><strong className="text-white">Adresse:</strong> SKILL CGN, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.</p>
          <p><strong className="text-white">Öffnungszeiten:</strong> Montag bis Donnerstag 7 bis 22 Uhr, Freitag 7 bis 20 Uhr, Samstag und Sonntag 9 bis 20 Uhr.</p>
          <p><strong className="text-white">Mitbringen:</strong> Sportsachen, saubere Hallenschuhe.</p>
          <p>Widerruf 14 Tage ab Abschluss, Details in den <Link to="/agb" className="underline text-[#FBFF00]">AGB</Link>.</p>
        </div>
      </div>
    </main>
  );
}
