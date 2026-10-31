/*
 * SKILL CGN — Shop Danke-Seite (manus-src/client/src/pages/ShopSuccess.tsx). Ziel des Stripe Payment Links:
 * /shop/danke?p=<produkt-id>&session_id={CHECKOUT_SESSION_ID}. Kaufmessung für Meta und Google nur mit Consent, einmal je Sitzung.
 */
import { useEffect, useMemo } from "react";
import { Check, ArrowRight, Calendar, MessageCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { consent, CONSENT_EVENT, track } from "@/lib/pixel";
import { gadsConversion } from "@/lib/gads";
import { WHATSAPP } from "@/lib/magicline";
import { findProduct, shopPrice } from "@/lib/shop";

export default function ShopDanke() {
  usePageMeta("Danke für deinen Kauf — SKILL CGN", "Dein Ticket ist bestätigt.", "noindex,nofollow");
  const [params] = useSearchParams();
  const product = useMemo(() => findProduct(params.get("p")), [params]);
  const sessionId = params.get("session_id") || "";

  useEffect(() => {
    if (!product || !sessionId) return;
    const value = product.price / 100;
    /* Google Ads sofort (Consent Mode v2), Stripe-Sitzung als transaction_id gegen Doppelzählung */
    gadsConversion({ value, currency: "EUR", transactionId: sessionId });
    let fired = false;
    const fire = () => {
      if (fired) return; fired = true;
      const key = "skill-shop-purchase-" + sessionId;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
      let tries = 0;
      const send = () => {
        if (window.fbq) track("Purchase", { value, currency: "EUR", content_name: product.name, content_type: "product" }, { eventID: "shop_" + sessionId });
        else if (++tries < 20) setTimeout(send, 300);
      };
      send();
    };
    if (consent() === "accepted") setTimeout(fire, 300);
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 500); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [product, sessionId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center">
      <div className="container max-w-2xl py-20">
        <div className="w-20 h-20 bg-primary flex items-center justify-center mb-8"><Check className="w-10 h-10 text-primary-foreground" /></div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mb-4">Done.</h1>
        <p className="text-xl text-foreground/70 mb-2">Dein <span className="text-primary font-bold">{product?.name || "Ticket"}</span> ist bestätigt{product ? `, ${shopPrice(product.price)}` : ""}. Die Rechnung kommt per E-Mail von Stripe.</p>
        {sessionId && <p className="text-sm text-foreground/40 font-mono mb-8">Zahlungsreferenz: {sessionId.slice(-12)}</p>}
        <div className="border-2 border-foreground/10 p-6 md:p-8 bg-card mb-8 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4">Nächste Schritte</h3>
          {product?.category === "aktion" ? <div className="flex items-start gap-4"><Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /><div><p className="font-bold text-sm">Vorbeikommen</p><p className="text-foreground/50 text-sm">Komm zu den Öffnungszeiten in die Herzogstraße 16–20, nenn am Empfang deine E-Mail-Adresse. Deine sechs Monate Gym starten mit dem ersten Besuch.</p></div></div> : <div className="flex items-start gap-4"><Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /><div><p className="font-bold text-sm">Kurs buchen</p><p className="text-foreground/50 text-sm">Geh auf die Kursseite und wähle deinen nächsten Termin. Dein Ticket wird beim ersten Besuch im Studio hinterlegt.</p></div></div>}
          <div className="flex items-start gap-4"><MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /><div><p className="font-bold text-sm">Fragen? WhatsApp.</p><p className="text-foreground/50 text-sm">Schreib uns, wir helfen dir bei der Kurswahl.</p></div></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/classes" className="inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm px-8 py-4 hover:bg-primary/90 transition-all">Kurs buchen <ArrowRight className="w-4 h-4" /></Link>
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 border-2 border-foreground/30 text-foreground font-black uppercase tracking-widest text-sm px-8 py-4 hover:border-primary hover:text-primary transition-all"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
