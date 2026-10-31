/*
 * SKILL CGN — Shop (manus-src/client/src/pages/Shop.tsx, optisch 1:1). Technik: Stripe Payment Links statt tRPC + Checkout-Session.
 * Kein Login, keine Datenbank. Kaufknopf öffnet den Stripe-Link des Produkts, Stripe leitet nach Zahlung auf /shop/danke.
 */
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShoppingBag, Zap, Shield, Clock, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { track } from "@/lib/pixel";
import { WHATSAPP } from "@/lib/magicline";
import { SHOP_PRODUCTS, shopPrice, type ShopProduct } from "@/lib/shop";
import { OffersJsonLd } from "@/lib/jsonld";

function ProductCard({ product, onSelect, selected }: { product: ShopProduct; onSelect: (id: string) => void; selected: boolean }) {
  return (
    <div onClick={() => onSelect(product.id)} role="radio" aria-checked={selected} tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(product.id); } }}
      className={`relative cursor-pointer border-2 transition-all duration-200 p-6 md:p-8 group ${selected ? "border-primary bg-primary/5" : "border-foreground/10 hover:border-primary/50 bg-card"}`}>
      {product.popular && <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1">Beliebt</div>}
      {product.oneTimeOnly && <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1">Einmalig, 52 % Ersparnis</div>}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">{product.name}</h3>
          <p className="text-foreground/50 text-sm mt-1">{product.description}</p>
        </div>
        <div className={`w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 mt-1 ${selected ? "border-primary bg-primary" : "border-foreground/30"}`}>{selected && <Check className="w-4 h-4 text-primary-foreground" />}</div>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl md:text-4xl font-black text-primary font-mono">{shopPrice(product.price)}</span>
        {product.originalPrice && <span className="text-xl text-foreground/30 line-through font-bold font-mono">{shopPrice(product.originalPrice)}</span>}
      </div>
      <ul className="space-y-2">
        {product.features.map(f => <li key={f} className="flex items-center gap-2 text-sm text-foreground/70"><Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />{f}</li>)}
      </ul>
    </div>
  );
}

export default function Shop() {
  usePageMeta("Tickets und Pässe fürs Gym in Köln — SKILL CGN", "Drop In 20 €, Trial Pass 29 €, 5er und 10er Pass, Personal Training in Köln. Kein Abo, kein Account. Sicher bezahlen mit Apple Pay, Karte, SEPA oder Klarna.");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { track("ViewContent", { content_name: "Shop", content_category: "Tickets" }); }, []);

  const tickets = SHOP_PRODUCTS.filter(p => p.category !== "pt" && p.category !== "aktion");
  const pt = SHOP_PRODUCTS.filter(p => p.category === "pt");
  const product = SHOP_PRODUCTS.find(p => p.id === selected) || null;
  const waText = product ? `Hallo, ich möchte ${product.name} (${shopPrice(product.price)}) kaufen.` : "";

  const buy = () => {
    if (!product) return;
    track("InitiateCheckout", { content_name: product.name, value: product.price / 100, currency: "EUR" });
    window.location.href = product.paymentLink || `${WHATSAPP}?text=${encodeURIComponent(waText)}`;
  };

  const grid = (items: ShopProduct[]) => (
    <div className="grid md:grid-cols-2 gap-4 md:gap-6" role="radiogroup">
      {items.map(p => <ProductCard key={p.id} product={p} onSelect={setSelected} selected={selected === p.id} />)}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OffersJsonLd offers={[{ name: "Drop In", price: 20, path: "/shop", description: "1 Kurs deiner Wahl bei SKILL CGN Köln, flexibel, ohne Bindung" }, { name: "Trial Pass", price: 29, path: "/shop", description: "3 Kurse zum Kennenlernen bei SKILL CGN Köln, einmalig pro Person, gültig 3 Wochen" }]} />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-20 border-b-4 border-primary">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, #fbff00 40px, #fbff00 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #fbff00 40px, #fbff00 41px)" }} />
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="container relative">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-10 font-black uppercase text-xs tracking-widest"><ArrowLeft className="w-4 h-4" /> Zurück</Link>
          <div className="max-w-3xl">
            <div className="inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 mb-5"><ShoppingBag className="w-3.5 h-3.5 inline mr-2" />Tickets & Pässe</div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-none mb-4">Kein Abo.<br /><span className="text-primary">Kein Account.</span><br />Einfach trainieren.<span className="mt-4 block font-mono text-xs font-bold tracking-[0.22em] text-foreground/50 md:text-sm">Tickets und Pässe fürs Gym in Köln</span></h1>
            <p className="text-lg text-foreground/60 max-w-xl">Wähle dein Ticket, bezahle in Sekunden mit Apple Pay, Kreditkarte, SEPA oder Klarna. Kein Login nötig.</p>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-4 bg-card border-b border-foreground/10">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-xs font-bold uppercase tracking-widest text-foreground/50">
            <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Sichere Zahlung über Stripe</span>
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Sofort gültig</span>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Keine Bindung</span>
          </div>
        </div>
      </section>

      {/* Produkte */}
      <section className="py-16 md:py-24">
        <div className="container max-w-5xl">
          <h2 className="text-xs font-black uppercase tracking-widest text-primary mb-6">Kurse</h2>
          {grid(tickets)}
          <div className="mt-14 mb-6 flex flex-wrap items-end justify-between gap-3"><h2 className="text-xs font-black uppercase tracking-widest text-primary">Personal Training</h2><Link to="/personal-training" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-foreground/70 hover:text-primary">Alles zum Personal Training <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          <p className="mb-6 text-sm text-foreground/55">Einzelstunde 60 Minuten, 5er- und 10er-Karte je 45 Minuten. Assessment, Anamnese, Programm und Geld-zurück-Garantie immer inklusive. Termin auf Anfrage per WhatsApp.</p>
          {grid(pt)}

          <div className="sticky bottom-4 z-20 mt-12">
            <button type="button" onClick={buy} disabled={!product}
              className={`w-full flex items-center justify-center gap-3 font-black uppercase tracking-widest text-sm py-5 transition-all duration-200 ${product ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.01] shadow-xl" : "bg-foreground/10 text-foreground/30 cursor-not-allowed"}`}>
              {product ? (product.paymentLink ? <>{product.name}, {shopPrice(product.price)}, zur Zahlung <ArrowRight className="w-5 h-5" /></> : <>{product.name}, {shopPrice(product.price)}, per WhatsApp buchen <MessageCircle className="w-5 h-5" /></>) : <>Ticket auswählen <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
          <p className="text-center text-foreground/30 text-xs mt-4">Sichere Zahlung über Stripe. Apple Pay, Kreditkarte, SEPA, Klarna. Rechnung kommt per E-Mail.</p>
        </div>
      </section>

      {/* Memberships Hinweis */}
      <section className="py-16 bg-card border-t border-foreground/10">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4">Regelmäßig trainieren?</h2>
          <p className="text-foreground/50 mb-8">Mit einer Membership trainierst du günstiger, bekommst 3D-Körperscans, Trainingspläne und mehr. Neu bei SKILL? Starte mit START 39.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/start39" className="inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm px-8 py-4 hover:bg-primary/90 transition-all">Start für 39 € <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/memberships" className="inline-flex items-center justify-center gap-3 border-2 border-primary text-primary font-black uppercase tracking-widest text-sm px-8 py-4 hover:bg-primary hover:text-primary-foreground transition-all">Memberships ansehen <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
