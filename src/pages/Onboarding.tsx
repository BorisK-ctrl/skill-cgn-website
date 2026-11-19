/*
 * /onboarding: Onboarding-Termin wählen über den persönlichen Link aus der Mail (/onboarding?t=…). main.tsx verschiebt den Token sofort
 * aus der Adresse nach sessionStorage (skill-onboarding-t), damit er nicht bei Google Ads oder Meta landet. Buchung: OnboardingNext/OnboardingBooking.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import OnboardingNext from "@/components/OnboardingNext";
import { usePageMeta } from "@/lib/meta";
import { WHATSAPP } from "@/lib/magicline";

export default function Onboarding() {
  usePageMeta("Onboarding-Termin wählen — SKILL CGN", "Such dir deinen Termin für 3D-Scan, Einweisung und Trainingsplan aus.", "noindex,nofollow");
  /* undefined = noch nicht gelesen (Vorrendern), "" = kein Token */
  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    let t = ""; try { t = sessionStorage.getItem("skill-onboarding-t") || ""; } catch {}
    if (!t) t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);
  }, []);
  const waText = "Hi Boris, ich möchte meinen Onboarding-Termin ausmachen.";

  return (
    <main className="campaign-page min-h-screen overflow-x-clip bg-black text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="SKILL CGN Startseite"><img src="/img/logo-white.svg" alt="SKILL CGN" width={160} height={17} className="h-5 w-auto" /></Link>
          <span className="campaign-mono text-[10px] uppercase tracking-[0.18em] text-[#FBFF00]">Onboarding</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl min-w-0 px-5 pb-20 pt-2 md:pt-6">
        {token === undefined ? null : token ? (
          <OnboardingNext token={token} waText={waText} />
        ) : (
          <section className="mt-12">
            <h1 className="campaign-display text-5xl uppercase leading-[0.88]">Link <span className="text-[#FBFF00]">unvollständig.</span></h1>
            <p className="mt-4 text-base leading-relaxed text-white/75">Öffne den Link bitte direkt aus deiner E-Mail. Oder schreib Boris kurz, dann macht ihr den Termin per WhatsApp aus.</p>
            <a href={`${WHATSAPP}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className="campaign-button mt-6 flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-4 text-sm font-bold uppercase tracking-[0.1em] text-black hover:bg-white"><MessageCircle className="h-4 w-4" /> Termin per WhatsApp</a>
          </section>
        )}
        <div className="mt-12 space-y-2 border-t border-white/10 pt-6 text-sm text-white/60">
          <p><strong className="text-white">Adresse:</strong> SKILL CGN, Herzogstraße 16–20, 50667 Köln, zwei Minuten vom Neumarkt.</p>
          <p><strong className="text-white">Öffnungszeiten:</strong> Montag bis Donnerstag 7 bis 22 Uhr, Freitag 7 bis 20 Uhr, Samstag und Sonntag 9 bis 20 Uhr.</p>
          <p>Fragen: <a href={WHATSAPP} className="underline text-[#FBFF00]">WhatsApp 0176 10877603</a>.</p>
        </div>
      </div>
    </main>
  );
}
