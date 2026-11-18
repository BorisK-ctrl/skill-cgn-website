/*
 * /blackweek/danke: Ziel nach dem Black-Week-Abschluss (StartCheckout navigiert mit ?vertrag=<Vertragsnummer>).
 * Kauf-Event genau hier: Google Ads Conversion "Kauf" sofort (Consent Mode v2), Meta Purchase (value 29, EUR, content_name "ONLY GYM 29")
 * nur mit Zustimmung. Beide mit der Vertragsnummer als ID, je Vertrag nur einmal (sessionStorage), Dedup mit der Conversions API aus checkout-lead.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import OnboardingNext from "@/components/OnboardingNext";
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

  return (
    <main className="campaign-page min-h-screen overflow-x-clip bg-black text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="SKILL CGN Startseite"><img src="/img/logo-white.svg" alt="SKILL CGN" width={160} height={17} className="h-5 w-auto" /></Link>
          <span className="campaign-mono text-[10px] uppercase tracking-[0.18em] text-[#FBFF00]">Vertrag angelegt</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl min-w-0 px-5 pb-20 pt-10 md:pt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#FBFF00]"><Check className="h-6 w-6 text-black" strokeWidth={3} /></span>
          <p className={kicker}>Black Week · Gym Only</p>
        </div>
        <h1 className="campaign-display mt-5 text-6xl uppercase leading-[0.85] md:text-8xl">Du bist drin{c?.name ? "," : "."}{c?.name && <><br /><span className="text-[#FBFF00]">{c.name}.</span></>}</h1>
        <p className="mt-5 text-lg leading-relaxed text-white/80">Dein Vertrag ist angelegt. Eine Mail mit Vertrag und SEPA-Mandat ist unterwegs.</p>
        {c?.cid && <p className="campaign-mono mt-2 text-[10px] uppercase tracking-[0.16em] text-white/40">Vertragsnummer {c.cid}</p>}

        <OnboardingNext waText={`Hi Boris, ich habe gerade Gym Only 29 gebucht${c?.name ? `, ${c.name}` : ""}. Wann passt mein Onboarding?`} />

        <div className="mt-12 space-y-2 border-t border-white/10 pt-6 text-sm text-white/60">
          <p><strong className="text-white">Adresse:</strong> SKILL CGN, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.</p>
          <p><strong className="text-white">Öffnungszeiten:</strong> Montag bis Donnerstag 7 bis 22 Uhr, Freitag 7 bis 20 Uhr, Samstag und Sonntag 9 bis 20 Uhr.</p>
          <p>Widerruf 14 Tage ab Abschluss, Details in den <Link to="/agb" className="underline text-[#FBFF00]">AGB</Link>. Fragen: <a href={WHATSAPP} className="underline text-[#FBFF00]">WhatsApp 0176 10877603</a>.</p>
        </div>
      </div>
    </main>
  );
}
