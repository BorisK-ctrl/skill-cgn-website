/* Cookie-Banner (manus-src/client/src/components/CookieConsent.tsx) mit src/lib/pixel.ts */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { consent, setConsent, loadPixel, OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/pixel";

type Choice = "accepted" | "denied";

export default function CookieConsent() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const stored = consent();
    setChoice(stored);
    if (stored === "accepted") loadPixel();
    if (!stored) { const timer = window.setTimeout(() => setIsVisible(true), 800); return () => window.clearTimeout(timer); }
  }, []);

  const choose = (next: Choice) => { setConsent(next); setChoice(next); setIsVisible(false); };

  /* Wiederöffnen über den Textlink "Cookie-Einstellungen" im Footer */
  useEffect(() => {
    const open = () => { setChoice(null); setIsVisible(true); };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-in-from-bottom">
      <div className="border-t-2 border-[#FBFF00] bg-[#2A3133] px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] md:px-8 md:py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-white/90 md:text-sm">
              Notwendige Funktionen laufen ohne Marketing-Cookies. Meta Pixel und personalisierte Werbemessung werden erst nach deiner Zustimmung geladen.{" "}
              <Link to="/datenschutz" className="font-medium text-[#FBFF00] hover:underline">Datenschutz</Link>{" · "}
              <Link to="/impressum" className="font-medium text-[#FBFF00] hover:underline">Impressum</Link>
            </p>
          </div>
          <div className="flex w-full flex-shrink-0 items-center gap-3 md:w-auto">
            <button type="button" onClick={() => choose("denied")} className="flex-1 border border-white/20 px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-white/80 transition-colors hover:border-white/40 md:flex-none">Nur notwendige</button>
            <button type="button" onClick={() => choose("accepted")} className="flex-1 bg-[#FBFF00] px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-black transition-colors hover:bg-[#FBFF00]/90 md:flex-none">Marketing akzeptieren</button>
            <button type="button" onClick={() => choose("denied")} className="p-2 text-white/50 transition-colors hover:text-white md:hidden" aria-label="Cookie-Banner schließen und nur notwendige Cookies verwenden"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
