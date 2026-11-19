/*
 * Nächster Schritt nach dem Abschluss (Dankeseiten, /onboarding): Onboarding-Termin buchen und klar sagen, was den Kunden erwartet (Boris, 18.11.2026).
 * Termin direkt auf der Seite (OnboardingBooking, live aus unseren Google-Kalendern, 90 Minuten). Ist die Anbindung nicht eingerichtet:
 * Google-Terminplan (VITE_ONBOARDING_BOOKING_URL, eingebettet) oder WhatsApp an Boris.
 */
import { useState, type ReactNode } from "react";
import { CalendarCheck, MessageCircle, ScanLine, Watch, ClipboardList, Dumbbell, Shirt, Footprints, ExternalLink, Smartphone, ArrowRight } from "lucide-react";
import { ONBOARDING_BOOKING_URL, WHATSAPP, TECHNOGYM_APP } from "@/lib/magicline";
import { trackCta } from "@/lib/events";
import OnboardingBooking from "@/components/OnboardingBooking";

const kicker = "campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]";
const EXPECT = [
  { icon: ScanLine, t: "3D-Körperscan und Assessment", d: "Dein Startpunkt in Zahlen: Muskeln, Körperfett, Haltung." },
  { icon: Watch, t: "Dein Bändchen", d: "Damit kommst du ab dem Tag jederzeit ins Gym." },
  { icon: ClipboardList, t: "Dein Trainingsplan", d: "Wir erstellen ihn für dich, passend zu deinem Scan und deinem Ziel." },
  { icon: Dumbbell, t: "Einweisung, dann geht's los", d: "Wir zeigen dir Geräte und Ablauf. Danach startest du durch." },
] as const;

/** booking: anderes Buchungs-Widget statt OnboardingBooking (offene Seite /onboarding ohne persönlichen Link), bekommt den WhatsApp-Rückfall und onBooked */
export default function OnboardingNext({ waText, checkoutToken, contractId, token, booking }: { waText: string; checkoutToken?: string; contractId?: string; token?: string; booking?: (fallback: ReactNode, onBooked: (b: boolean) => void) => ReactNode }) {
  const wa = `${WHATSAPP}?text=${encodeURIComponent(waText)}`;
  const [booked, setBooked] = useState(false);
  const embed = ONBOARDING_BOOKING_URL ? ONBOARDING_BOOKING_URL + (ONBOARDING_BOOKING_URL.includes("?") ? "&" : "?") + "gv=true" : "";
  /* Bisheriger Weg, solange die Kalender-Anbindung fehlt */
  const fallback = (
    <>
        {ONBOARDING_BOOKING_URL ? (
          <div className="mt-6 border-2 border-[#FBFF00] bg-white">
            <iframe src={embed} title="Onboarding-Termin buchen" className="block h-[640px] w-full" loading="eager" />
            <a href={ONBOARDING_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="campaign-button flex min-h-12 items-center justify-center gap-2 bg-[#FBFF00] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-white"><ExternalLink className="h-4 w-4" /> Kalender groß öffnen</a>
          </div>
        ) : (
          <div className="mt-6 border-2 border-[#FBFF00] bg-[#1a2224] p-5">
            <p className="flex items-start gap-3 text-sm leading-relaxed text-white/80"><CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#FBFF00]" /> Schreib Boris kurz, wann es dir passt. Er meldet sich innerhalb von 24 Stunden mit deinem Termin.</p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="campaign-button mt-4 flex min-h-14 w-full items-center justify-center gap-3 bg-[#FBFF00] px-4 py-4 text-sm font-bold uppercase tracking-[0.1em] text-black hover:bg-white"><MessageCircle className="h-4 w-4 shrink-0" /> Termin per WhatsApp</a>
          </div>
        )}
        {ONBOARDING_BOOKING_URL && <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70 underline underline-offset-4 hover:text-[#FBFF00]"><MessageCircle className="h-4 w-4" /> Kein passender Termin? Schreib Boris</a>}
    </>
  );
  return (
    <section className="mt-12 min-w-0" aria-labelledby="onboarding-h">
      <p className={kicker}>{booked ? "Gebucht" : "Dein nächster Schritt"}</p>
      <h2 id="onboarding-h" className="campaign-display mt-3 text-5xl uppercase leading-[0.88] md:text-6xl">{booked ? "Dein" : "Buch deinen"}<br /><span className="text-[#FBFF00]">Onboarding-Termin.</span></h2>
      <p className="mt-4 text-base leading-relaxed text-white/75">90 Minuten mit Coach, bei uns in der Herzogstraße. Danach trainierst du, wann es dir passt.</p>

      {booking ? booking(fallback, setBooked) : <OnboardingBooking token={token} checkoutToken={checkoutToken} contractId={contractId} waText={waText} fallback={fallback} onBooked={setBooked} />}

      <p className={`${kicker} mt-12`}>Das erwartet dich beim Onboarding</p>
      <ol className="mt-4 grid gap-px bg-white/15">
        {EXPECT.map(({ icon: Icon, t, d }, i) => (
          <li key={t} className="flex items-start gap-4 bg-black px-4 py-4">
            <span className="campaign-display w-8 shrink-0 text-3xl leading-none text-[#FBFF00]">0{i + 1}</span>
            <span className="min-w-0"><span className="flex items-center gap-2 text-base font-bold text-white"><Icon className="h-4 w-4 shrink-0 text-[#FBFF00]" />{t}</span><span className="mt-1 block text-sm leading-relaxed text-white/65">{d}</span></span>
          </li>
        ))}
      </ol>

      <p className={`${kicker} mt-10`}>Mitbringen</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li className="flex items-center gap-2 border border-white/25 px-3 py-2 text-sm font-bold"><Shirt className="h-4 w-4 text-[#FBFF00]" /> Sportklamotten</li>
        <li className="flex items-center gap-2 border border-white/25 px-3 py-2 text-sm font-bold"><Footprints className="h-4 w-4 text-[#FBFF00]" /> Saubere Hallenschuhe</li>
      </ul>
      <p className="mt-3 text-sm text-white/60">Handtuch, Getränke und Dusche haben wir für dich.</p>

      {/* Letzter Schritt: Technogym App (Boris, 19.11.2026) */}
      <div className="mt-10 border-2 border-[#FBFF00] bg-[#1a2224] p-5">
        <p className={kicker}>Deine App</p>
        <p className="mt-3 flex items-start gap-3 text-base font-bold text-white"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#FBFF00]" /> Lade dir unsere App von Technogym herunter.</p>
        <p className="mt-2 text-sm leading-relaxed text-white/70">Am besten gleich, dann ist zum Onboarding alles startklar.</p>
        <a href={TECHNOGYM_APP} target="_blank" rel="noopener noreferrer" onClick={() => trackCta("cta_app_danke")} className="campaign-button mt-4 flex min-h-14 w-full items-center justify-center gap-2 border-2 border-[#FBFF00] px-4 text-sm font-bold uppercase tracking-[0.1em] text-[#FBFF00] hover:bg-[#FBFF00] hover:text-black">App herunterladen <ArrowRight className="h-4 w-4 shrink-0" /></a>
      </div>
    </section>
  );
}
