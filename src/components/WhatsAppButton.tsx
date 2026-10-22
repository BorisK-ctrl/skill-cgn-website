/* Großer grüner WhatsApp-Knopf mit vorbefülltem Text. Klick = Ereignis Contact an Meta (Standard-Ereignis) und Google, einmal je Sitzung, nur mit Zustimmung. */
import type { ReactNode } from "react";
import { WHATSAPP } from "@/lib/magicline";
import { trackOnce } from "@/lib/pixel";
import { utmParams } from "@/lib/events";

export default function WhatsAppButton({ text, name, className = "", children }: { text: string; name: string; className?: string; children: ReactNode }) {
  const href = `${WHATSAPP}?text=${encodeURIComponent(text)}`;
  const onClick = () => {
    const data = { content_name: name, ...utmParams() };
    trackOnce("contact-" + name, "Contact", data);
    try { if (window.gtag && !sessionStorage.getItem("skill-ev-g-contact-" + name)) { sessionStorage.setItem("skill-ev-g-contact-" + name, "1"); window.gtag("event", "contact", { event_category: "whatsapp", event_label: name }); } } catch {}
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={`campaign-button flex min-h-16 w-full items-center justify-center gap-3 bg-[#25D366] px-6 py-4 text-center text-base font-bold uppercase tracking-[0.12em] text-black hover:bg-[#1ebe5a] ${className}`}>{children}</a>
  );
}
