/*
 * /onboarding: Onboarding-Termin wählen (90 Minuten).
 * - Mit persönlichem Link (/onboarding?t=…, Mail nach dem Kauf): main.tsx verschiebt den Token sofort nach sessionStorage (skill-onboarding-t),
 *   damit er nicht bei Google Ads oder Meta landet. Buchung: OnboardingNext/OnboardingBooking.
 * - Ohne Link: offene Seite für den festen Link in der Magicline-Mail "Neues Mitglied". Kalender zuerst, dann Daten (ProbetrainingBooking kind=onboarding),
 *   Teammail "Mitgliedschaft prüfen".
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import OnboardingNext from "@/components/OnboardingNext";
import ProbetrainingBooking from "@/components/ProbetrainingBooking";
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
        {/* Mit persönlichem Link (Dankeseite, Mail): Buchung über den Link. Ohne Link (z. B. aus der Magicline-Mail "Neues Mitglied"):
            offene Buchung, erst die Zeit, dann Name, E-Mail, Telefon, optional Vertragsnummer. */}
        {token === undefined ? null : token ? (
          <OnboardingNext token={token} waText={waText} />
        ) : (
          <OnboardingNext waText={waText} booking={(fallback, onBooked) => <ProbetrainingBooking kind="onboarding" fallback={fallback} onBooked={onBooked} />} />
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
