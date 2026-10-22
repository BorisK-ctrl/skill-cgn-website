/* Athletic Brutalism – Global Footer (manus-src/client/src/components/Footer.tsx), feste deutsche Texte, Routen dieses Projekts */
import { Link } from "react-router-dom";
import { Mail, MapPin, Instagram, Facebook, Phone, MessageCircle } from "lucide-react";
import { WHATSAPP, PHONE_HREF } from "@/lib/magicline";
import { trackCta } from "@/lib/events";
import { openCookieSettings } from "@/lib/pixel";

export const OPENING_HOURS = [
  { days: "Montag – Donnerstag", hours: "07:00 – 22:00" },
  { days: "Freitag", hours: "07:00 – 20:00" },
  { days: "Samstag", hours: "09:00 – 20:00" },
  { days: "Sonntag", hours: "09:00 – 20:00" },
];

const linkCls = "text-sm font-bold text-foreground/70 hover:text-primary transition-colors duration-200 uppercase tracking-wide";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-card border-t-4 border-primary text-foreground pb-14 lg:pb-0">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          <div className="md:col-span-1">
            <div className="text-2xl font-black uppercase tracking-tight mb-4 font-display">SKILL <span className="text-primary">CGN</span></div>
            <p className="text-sm text-foreground/60 leading-relaxed mb-6">Impetus Kraftkonzept UG</p>
            <div className="flex gap-3">
              <a href="https://www.instagram.com/skill.cgn/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 border border-foreground/20 flex items-center justify-center hover:border-primary hover:text-primary transition-all duration-200"><Instagram className="w-4 h-4" /></a>
              <a href="https://www.facebook.com/skillcgn/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 border border-foreground/20 flex items-center justify-center hover:border-primary hover:text-primary transition-all duration-200"><Facebook className="w-4 h-4" /></a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-5 font-sans">Navigation</h3>
            <ul className="space-y-3">
              {[["Classes", "/classes"], ["Memberships", "/memberships#plans"], ["START 39", "/start39"], ["Probetraining", "/probetraining"], ["Shop", "/shop"], ["Kündigung", "/kuendigung"]].map(([label, href]) => (
                <li key={href}><Link to={href} className={linkCls}>{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-5 font-sans">Kontakt</h3>
            <ul className="space-y-4">
              <li><a href={PHONE_HREF} onClick={() => trackCta("cta_anrufen")} className="flex items-center gap-3 text-sm font-bold text-foreground/70 hover:text-primary transition-colors duration-200"><Phone className="w-4 h-4 text-primary flex-shrink-0" /> +49 221 70093636</a></li>
              <li><a href={WHATSAPP} onClick={() => trackCta("cta_whatsapp")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-bold text-foreground/70 hover:text-primary transition-colors duration-200"><MessageCircle className="w-4 h-4 text-primary flex-shrink-0" /> WhatsApp</a></li>
              <li><a href="mailto:info@skill-studios.com" className="flex items-center gap-3 text-sm font-bold text-foreground/70 hover:text-primary transition-colors duration-200"><Mail className="w-4 h-4 text-primary flex-shrink-0" /> info@skill-studios.com</a></li>
              <li><a href="https://maps.google.com/?q=Herzogstra%C3%9Fe+16-20,+50667+K%C3%B6ln" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-bold text-foreground/70 hover:text-primary transition-colors duration-200"><MapPin className="w-4 h-4 text-primary flex-shrink-0" /> Herzogstr. 16–20, 50667 Köln</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-5 font-sans">Öffnungszeiten</h3>
            <ul className="space-y-2">
              {OPENING_HOURS.map(item => (
                <li key={item.days} className="flex justify-between gap-3 text-sm font-bold text-foreground/70"><span>{item.days}</span><span className="text-primary tabular-nums whitespace-nowrap">{item.hours}</span></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-5 font-sans">Partner</h3>
            <ul className="space-y-3">
              <li><Link to="/classes#format-hyrox" className={linkCls}>HYROX Official Gym</Link></li>
              <li><Link to="/classes#format-athx" className={linkCls}>ATHX Affiliate</Link></li>
              <li><a href="https://urbansportsclub.com/de/venues/18836" target="_blank" rel="noopener noreferrer" className={linkCls}>Urban Sports Club</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-foreground/10">
        <div className="container pt-6"><p className="text-xs leading-relaxed text-foreground/50">SKILL CGN ist ein Fitnessstudio und HYROX Official Gym in der Kölner Innenstadt: Herzogstraße 16-20, 50667 Köln, zwei Minuten vom Neumarkt, Parkhaus Brückenstraße (Ludwigstraße 1). Geöffnet Montag bis Donnerstag 07:00 bis 22:00 Uhr, Freitag 07:00 bis 20:00 Uhr, Samstag und Sonntag 09:00 bis 20:00 Uhr. Telefon +49 221 70093636, WhatsApp +49 176 10877603, info@skill-studios.com. Betreiber: Impetus Kraftkonzept UG (haftungsbeschränkt).</p></div>
        <div className="container py-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-foreground/40 font-medium text-center sm:text-left">© {currentYear} Impetus Kraftkonzept UG (haftungsbeschränkt) · Skill Cologne</p>
          <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 sm:justify-end">
            {[["Impressum", "/impressum"], ["Datenschutz", "/datenschutz"], ["AGB", "/agb"]].map(([label, href]) => (
              <Link key={href} to={href} className="text-xs font-bold text-foreground/50 hover:text-primary transition-colors duration-200 uppercase tracking-widest whitespace-nowrap">{label}</Link>
            ))}
            <button type="button" onClick={openCookieSettings} className="text-xs font-bold text-foreground/50 hover:text-primary transition-colors duration-200 uppercase tracking-widest whitespace-nowrap">Cookie-Einstellungen</button>
            <a href="/team/login" className="text-xs font-bold text-foreground/50 hover:text-primary transition-colors duration-200 uppercase tracking-widest whitespace-nowrap">Team</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
