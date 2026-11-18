import { Component, type ErrorInfo, type ReactNode } from "react";

import { WHATSAPP } from "@/lib/magicline";
const KEY = "skill-reload-once";

/* Fängt Abstürze beim Rendern ab, damit nie eine schwarze Seite stehen bleibt.
   Häufigster Fall: nach einem Deploy fehlt ein alter JS-Baustein (Code-Splitting). Dann einmal neu laden.
   Sonst: Hinweis mit Neu-laden-Knopf und WhatsApp, der Fehler landet in der Konsole. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SKILL] Render-Fehler", error, info.componentStack);
    const msg = String(error?.message || error);
    const chunk = /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|error loading dynamically imported/i.test(msg);
    let reloaded = false; try { reloaded = sessionStorage.getItem(KEY) === "1"; } catch {}
    if (chunk && !reloaded) { try { sessionStorage.setItem(KEY, "1"); } catch {} window.location.reload(); }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0f10] px-6 text-white">
        <div className="w-full max-w-md border-l-4 border-[#FBFF00] bg-[#1a2224] p-6">
          <p className="text-lg font-bold">Hier ist etwas schiefgelaufen.</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">Die Seite konnte nicht angezeigt werden. Lade sie einmal neu. Wenn du gerade einen Vertrag abgeschlossen hast: Es wurde nichts doppelt angelegt, schreib Boris kurz, er prüft das.</p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => { try { sessionStorage.removeItem(KEY); } catch {} window.location.reload(); }} className="flex min-h-12 w-full items-center justify-center bg-[#FBFF00] px-5 text-sm font-bold uppercase tracking-[0.14em] text-black hover:bg-white">Seite neu laden</button>
            <a href={`${WHATSAPP}?text=${encodeURIComponent("Hi Boris, auf der Website kam eine Fehlerseite: " + location.pathname)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-12 w-full items-center justify-center border border-white/30 px-5 text-sm font-bold uppercase tracking-[0.14em] text-white hover:border-[#FBFF00]">Boris per WhatsApp schreiben</a>
          </div>
        </div>
      </div>
    );
  }
}
