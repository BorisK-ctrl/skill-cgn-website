import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Hero from "@/components/Hero";
import { usePageMeta } from "@/lib/meta";
import { WHATSAPP, OFFERS, ONBOARDING_BOOKING_URL } from "@/lib/magicline";
import { consent, CONSENT_EVENT, track } from "@/lib/pixel";
import { gadsConversion } from "@/lib/gads";
import { utmParams } from "@/lib/events";
import WhatsAppButton from "@/components/WhatsAppButton";
import { MessageCircle } from "lucide-react";

const DEFAULT = "Dein Vertrag ist angelegt. Die Bestätigung mit allen Unterlagen kommt in den nächsten Minuten per E-Mail.";

export default function Danke() {
  usePageMeta("Willkommen im Team — SKILL CGN", "Dein Vertrag ist angelegt.", "noindex,nofollow");
  const [text, setText] = useState(DEFAULT);
  /* WhatsApp-Knopf: Vorname und Angebot aus dem Vertrag (sessionStorage), Text je nach START 39 / BACK 39 */
  const [wa, setWa] = useState<{ name: string; offer: string }>({ name: "", offer: "" });
  const [params] = useSearchParams();
  const stripeSession = params.get("stripe") || "";
  /* Express-Abschluss: nach einer Weiterleitung (3-D Secure) kommt ?express=TOKEN zurück; der Vertrag entsteht über "complete" der Express-Function. */
  const expressToken = /^[a-z0-9]{16,48}$/.test(params.get("express") || "") ? params.get("express")! : "";
  const pendingKey = stripeSession || expressToken;
  /* Kartenweg: Stripe leitet mit ?stripe=SESSION zurück. Der Vertrag entsteht im Webhook; hier bis zu 40 s auf die Vertragsnummer warten, dann wie gewohnt messen. */
  const [ready, setReady] = useState(!pendingKey);
  const [waiting, setWaiting] = useState(!!pendingKey);
  useEffect(() => {
    if (!pendingKey) return;
    let p: any = null; try { p = JSON.parse(sessionStorage.getItem("skill-contract-pending") || "null"); } catch {}
    if (expressToken) p = { ...(p || {}), token: expressToken };
    if (!p?.token) { setWaiting(false); setText("Deine Zahlung ist eingegangen. Dein Vertrag wird gerade angelegt, die Bestätigung kommt per E-Mail."); return; }
    let tries = 0; let t = 0; let stopped = false;
    const poll = async () => {
      try {
        const r = expressToken
          ? await fetch("/api/stripe/express", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", token: p.token }) })
          : await fetch(`/api/checkout-lead?token=${encodeURIComponent(p.token)}&status=1`);
        const j = r.ok ? await r.json() : null;
        if (j?.done && j.contractId) {
          try { sessionStorage.setItem("skill-contract", JSON.stringify({ offer: p.offer || "START 39", cid: j.contractId, customer: j.customerNumber, name: p.name || "", start: p.start, price: p.price, payment: expressToken ? "express" : "card" })); sessionStorage.removeItem("skill-contract-pending"); } catch {}
          if (!stopped) { setWaiting(false); setReady(true); }
          return;
        }
      } catch {}
      if (++tries < 20 && !stopped) t = window.setTimeout(poll, 2000);
      else if (!stopped) { setWaiting(false); setText(`${p.name ? `Hey ${p.name}, deine` : "Deine"} Zahlung ist eingegangen. Dein ${p.offer || "START 39"} Vertrag wird gerade angelegt, die Bestätigung mit allen Unterlagen kommt in den nächsten Minuten per E-Mail.`); }
    };
    poll();
    return () => { stopped = true; window.clearTimeout(t); };
  }, [pendingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    try {
      const c = JSON.parse(sessionStorage.getItem("skill-contract") || "null");
      if (c) setWa({ name: c.name || "", offer: c.offer || "" });
      if (c?.cid) setText(`${c.name ? `Hey ${c.name}, dein` : "Dein"} ${c.offer} Vertrag ist angelegt (Vertragsnummer ${c.cid}).${c.start ? ` Start am ${new Date(c.start).toLocaleDateString("de-DE")}.` : ""} Die Bestätigung mit allen Unterlagen kommt in den nächsten Minuten per E-Mail.`);
    } catch {}
  }, [ready]);

  /* Kauf messen am echten Erfolgspunkt (Vertragsnummer liegt vor). Google Ads Conversion sofort (Consent Mode v2, ohne Zustimmung cookielos),
     Meta Purchase nur mit Zustimmung, sofort oder beim Erteilen auf dieser Seite. Beide mit derselben ID (Vertragsnummer), je Vertrag nur einmal. */
  useEffect(() => {
    if (!ready) return;
    let c: any = null; try { c = JSON.parse(sessionStorage.getItem("skill-contract") || "null"); } catch {}
    /* Echter Vertragswert aus dem Abschluss (39, 89, 109, 129 oder 149); fehlt er, Listenpreis des Tarifs aus OFFERS. Vertragsnummer als transaction_id. */
    const listPrice = Object.values(OFFERS).find(o => o.title === c?.offer)?.value ?? 39;
    const value = typeof c?.price === "number" && c.price > 0 ? c.price : listPrice;
    const cid: string | undefined = c?.cid || undefined;
    if (cid) gadsConversion({ value, currency: "EUR", transactionId: cid });
    let fired = false;
    const fire = () => {
      if (fired || !cid) return; fired = true;
      /* Meta Purchase: Pixel lädt nach Consent asynchron, daher kurz warten, bis fbq da ist. Sperre je Vertrag gegen Doppelzählung. */
      const key = "skill-meta-purchase-" + cid;
      let done = false; try { done = !!sessionStorage.getItem(key); } catch {}
      if (!done) {
        let tries = 0;
        const send = () => {
          /* event_id = Vertragsnummer (Dublettenschutz bei Meta, gleiche ID wie transaction_id bei Google) */
          if (window.fbq) { track("Purchase", { value, currency: "EUR", content_name: c?.offer || "SKILL Mitgliedschaft", content_type: "product", ...utmParams() }, { eventID: cid }); try { sessionStorage.setItem(key, "1"); } catch {} }
          else if (++tries < 20) setTimeout(send, 300);
        };
        send();
      }
    };
    if (consent() === "accepted") setTimeout(fire, 300);
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "accepted") setTimeout(fire, 500); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [ready]);
  return (
    <Hero kick={waiting ? "Zahlung eingegangen" : "Willkommen im Team"} title={<>Du bist<br />dabei.</>} titleClass="!text-[clamp(2.6rem,9vw,5.5rem)]" lead={waiting ? "Einen Moment, dein Vertrag wird gerade in unserem Mitgliedersystem angelegt …" : text}>
      <div className="notice"><strong>So geht es weiter.</strong> Komm einfach zu deinem ersten Training vorbei, wir richten vor Ort alles ein und zeigen dir das Studio. Kurse buchst du über die App oder auf der <Link to="/classes" className="underline">Kursseite</Link>.</div>
      {!waiting && ONBOARDING_BOOKING_URL && <a href={ONBOARDING_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn mt-6 w-full justify-center">Scan-Termin wählen</a>}
      {!waiting && <WhatsAppButton name={wa.offer === "BACK 39" ? "whatsapp_back39_danke" : "whatsapp_start39_danke"} text={`Hi Boris, ich habe gerade ${wa.offer === "BACK 39" ? "BACK 39" : "START 39"} abgeschlossen${wa.name ? `, ${wa.name}` : ""}, wann kann ich zum Scan kommen?`} className="mt-6"><MessageCircle className="h-5 w-5" /> {ONBOARDING_BOOKING_URL ? "Oder schreib Boris" : "Schick mir jetzt kurz Hallo auf WhatsApp"}</WhatsAppButton>}
      <div className="btns"><Link className="btn" to="/classes">Kursplan ansehen</Link><a className="btn-ghost" href={WHATSAPP} rel="noopener">Fragen per WhatsApp</a></div>
    </Hero>
  );
}
