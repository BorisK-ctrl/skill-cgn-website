/* Athletic Brutalism – Global Navbar (manus-src/client/src/components/Navbar.tsx), Sprachwechsel entfernt, Routen dieses Projekts */
import { useState } from "react";
import { ArrowRight, Menu, X, MessageCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { WHATSAPP } from "@/lib/magicline";
import { useBlackMonthActive } from "@/lib/blackmonth";
import { usePromo } from "@/lib/blackweek";

const baseLinks = [
  { href: "/classes", label: "Classes" },
  { href: "/memberships", label: "Memberships" },
  { href: "/probetraining", label: "Probetraining" },
  { href: "/personal-training", label: "Personal Training" },
  { href: "/shop", label: "Shop" },
  { href: "/start39", label: "START 39" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const promo = usePromo();
  const navLinks = useBlackMonthActive() ? [{ href: "/blackmonth", label: "Black Month" }, ...baseLinks] : baseLinks;
  const go = (href: string) => { setMobileMenuOpen(false); navigate(href); };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b-2 border-primary">
      <div className="container flex items-center justify-between h-20">
        <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
          <img src="/img/logo-white.svg" alt="SKILL CGN — Performance Training Köln" className="h-7 md:h-10 w-auto max-w-[180px] md:max-w-none" />
        </Link>

        <div className="hidden md:flex items-center gap-10 ml-12">
          {navLinks.map(item => (
            <Link key={item.href} to={item.href} className="text-sm font-bold tracking-wide hover:text-primary transition-colors duration-200 uppercase whitespace-nowrap">{item.label}</Link>
          ))}
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black uppercase text-sm px-4 py-3 hover:bg-white transition-all duration-200 hover:scale-[1.02]">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
          <Link to={promo.path} className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black uppercase text-sm px-6 py-3 hover:bg-white transition-all duration-200 hover:scale-[1.02]">
            {promo.nav} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-3">
          <button className="p-2 hover:bg-foreground/10 rounded transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menü öffnen" aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-background border-t-2 border-primary">
          <div className="container py-4 space-y-1">
            {navLinks.map(item => (
              <a key={item.href} href={item.href} onClick={e => { e.preventDefault(); go(item.href); }} className="block text-sm font-bold tracking-wide hover:text-primary transition-colors duration-200 uppercase py-3 border-b border-foreground/10">{item.label}</a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-black uppercase text-sm px-6 py-4 hover:bg-white transition-all"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
              <a href={promo.path} onClick={e => { e.preventDefault(); go(promo.path); }} className="block w-full bg-primary text-primary-foreground font-black uppercase text-sm px-6 py-4 hover:bg-white transition-all text-center">{promo.nav}</a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
