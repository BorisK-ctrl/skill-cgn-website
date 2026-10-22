/* /scan/danke: Hauptknopf ist WhatsApp. Erst wenn der Kunde selbst schreibt, kann die automatische Begrüßung auf WhatsApp antworten.
   Vorname und Wunschzeit aus sessionStorage (von /scan). Klick auf WhatsApp = Ereignis Contact an Meta und Google, einmal je Sitzung. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { WHATSAPP } from "@/lib/magicline";
import { SCAN_KEY } from "@/pages/Scan";
import WhatsAppButton from "@/components/WhatsAppButton";

const LOGO_WHITE = "/img/manus/skill-cgn-original-white_18b77f12.svg";
export default function ScanDanke() {
  usePageMeta("Danke, Boris meldet sich — SKILL CGN", "Deine Scan-Anfrage ist da.", "noindex,nofollow");
  const [d, setD] = useState<{ firstName?: string; time?: string }>({});
  useEffect(() => { try { setD(JSON.parse(sessionStorage.getItem(SCAN_KEY) || "{}")); } catch {} }, []);
  const name = d.firstName || "";
  const text = `Hi Boris, ich habe gerade einen Scan Termin angefragt${name ? `, ${name}` : ""}${d.time ? `, Wunschzeit ${d.time}` : ""}.`;
  return (
    <main className="campaign-page min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black"><div className="mx-auto max-w-[1480px] px-5 py-4 md:px-10"><Link to="/" aria-label="SKILL CGN"><img src={LOGO_WHITE} alt="SKILL CGN" className="h-5 w-auto md:h-7" width={160} height={28} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/img/logo-white.svg"; }} /></Link></div></header>
      <div className="mx-auto max-w-2xl px-5 py-12 md:px-10 md:py-20">
        <p className="campaign-mono text-[10px] uppercase tracking-[0.22em] text-[#FBFF00]">Anfrage angekommen</p>
        <h1 className="campaign-display mt-3 text-[52px] uppercase leading-[0.88] sm:text-7xl">Danke{name ? ` ${name}` : ""}, Boris meldet sich per WhatsApp.</h1>
        <p className="mt-5 text-base leading-relaxed text-white/75">Schreib ihm jetzt kurz Hallo, dann landet dein Termin direkt in seinem Chat und du bekommst sofort eine Antwort.</p>
        <WhatsAppButton text={text} name="whatsapp_scan_danke" className="mt-8"><MessageCircle className="h-5 w-5" /> Schick mir jetzt kurz Hallo auf WhatsApp</WhatsAppButton>
        <p className="mt-6 text-sm text-white/60">Oder <Link to="/start39" className="font-bold text-[#FBFF00] underline">direkt starten für 39 € im Monat</Link> <ArrowRight className="inline h-3.5 w-3.5 text-[#FBFF00]" /></p>
      </div>
    </main>
  );
}
