/*
 * /personal-training: Verkaufsseite für 1:1 Training mit Boris.
 * Aufbau nach den Mustern gut positionierter PT-Anbieter (Ultimate Performance, Boutique-PT-Studios):
 * ein Versprechen im Hero, Assessment als Einstieg, Pakete statt Einzelstunden im Fokus, Leistungen klar aufgelistet, Garantie, Coach sichtbar.
 * Preise und Stripe-Links aus src/lib/shop.ts (Kategorie pt). Termin immer auf Anfrage per WhatsApp.
 * Tracking nur nach Zustimmung: ViewContent (Personal Training) beim Laden, Contact beim WhatsApp-Klick, InitiateCheckout beim Kauf.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ClipboardCheck, FileText, ListChecks, MessageCircle, ShieldCheck, Target } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { track, trackOnce } from "@/lib/pixel";
import { trackCta, utmParams } from "@/lib/events";
import { WHATSAPP } from "@/lib/magicline";
import { SHOP_PRODUCTS, shopPrice } from "@/lib/shop";

const WA_TEXT = "Hallo Boris, ich interessiere mich für Personal Training. Wann passt ein Termin für das Assessment?";
const WA = `${WHATSAPP}?text=${encodeURIComponent(WA_TEXT)}`;
const kicker = "inline-block bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary-foreground";
const h2 = "font-display text-5xl md:text-7xl uppercase leading-[0.85] tracking-tight";

const INCLUDED = [
  { Icon: ClipboardCheck, title: "Komplettes Assessment", text: "Kennenlernen, 3D Körperscan, Beweglichkeit, Kraft. Wir messen, wo du stehst, bevor wir trainieren." },
  { Icon: FileText, title: "Anamnese", text: "Vorgeschichte, Alltag, Ziel. Ohne Anamnese kein Programm, das zu dir passt." },
  { Icon: ListChecks, title: "Dein Trainingsprogramm", text: "Geschrieben für dich, mit deinem Namen. Für die Einheiten mit mir und die Tage dazwischen." },
  { Icon: Target, title: "Erfolgsversprechen", text: "Wir legen dein Ziel im Assessment fest, messbar und mit Datum. Dafür arbeiten wir." },
  { Icon: ShieldCheck, title: "Geld-zurück-Garantie", text: "Ziel nicht erreicht, obwohl du deine Einheiten gemacht hast? Dann bekommst du dein Geld zurück." },
] as const;
const FOR = [
  ["Hybrid Athleten", "HYROX, Laufen plus Kraft. Du willst in beidem besser werden, nicht nur in einem."],
  ["Technik an der Stange", "Kniebeuge, Kreuzheben, Drücken. Sauber, schwer, ohne Angst vor der Last."],
  ["Wieder einsteigen", "Nach Pause, Baby oder Bürojahren. Ein Plan, der dich abholt und nicht überfordert."],
  ["Körper verändern", "Weniger Fett, mehr Muskel. Mit Scan alle paar Wochen, damit du es schwarz auf weiß siehst."],
] as const;
const STEPS = [
  ["Schreib mir", "Eine Nachricht per WhatsApp. Ich antworte persönlich, du bekommst einen Termin für das Assessment."],
  ["Assessment und Anamnese", "60 Minuten im Gym. Scan, Bewegung, Kraft, Gespräch. Danach kennen wir dein Ziel und den Weg dahin."],
  ["Dein Programm", "Ich schreibe dein Programm. Du siehst vor der ersten Einheit, was in den nächsten Wochen passiert."],
  ["Training und Kontrolle", "Deine Einheiten mit mir, Check-ins dazwischen, Scan zur Kontrolle. Bis das Ziel steht."],
] as const;
const FAQ = [
  ["Wie buche ich einen Termin?", "Per WhatsApp, Termin auf Anfrage. Du schreibst, ich antworte persönlich mit freien Zeiten. Die Karten kannst du direkt online kaufen oder nach dem Assessment."],
  ["Wie lange dauert eine Einheit?", "Die Einzelstunde dauert 60 Minuten. Die Einheiten der 5er- und 10er-Karte dauern 45 Minuten, fokussiert und ohne Leerlauf."],
  ["Was ist im Preis enthalten?", "Immer: Kennenlernen mit komplettem Assessment, Anamnese, dein Trainingsprogramm und das Erfolgsversprechen mit Geld-zurück-Garantie. Keine Extras, keine versteckten Kosten."],
  ["Wie funktioniert die Geld-zurück-Garantie?", "Im Assessment legen wir dein Ziel messbar fest. Hast du alle Einheiten deiner Karte absolviert und das Ziel ist nicht erreicht, bekommst du den Kartenpreis zurück."],
  ["Brauche ich eine Mitgliedschaft?", "Nein. Personal Training funktioniert ohne Mitgliedschaft. Wenn du zusätzlich im Gym trainieren willst, passt die SKILL Mitgliedschaft dazu."],
] as const;

export default function PersonalTraining() {
  usePageMeta("Personal Training in Köln mit Boris — SKILL CGN", "1:1 Training in der Kölner Innenstadt. Assessment, Anamnese und Programm immer inklusive. Erfolgsversprechen mit Geld-zurück-Garantie. Termin auf Anfrage per WhatsApp.");
  const pt = SHOP_PRODUCTS.filter(p => p.category === "pt");
  useEffect(() => { setTimeout(() => trackOnce("vc-pt", "ViewContent", { content_name: "Personal Training", content_category: "PT", ...utmParams() }), 300); }, []);
  const contact = (where: string) => { track("Contact", { content_name: "Personal Training", content_category: "PT" }); trackCta(`cta_pt_whatsapp_${where}`); };
  const buy = (name: string, price: number) => track("InitiateCheckout", { content_name: name, content_category: "PT", value: price / 100, currency: "EUR" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden border-b-4 border-primary campaign-grid">
        <div className="container grid gap-10 py-14 md:grid-cols-12 md:items-center md:py-24">
          <div className="md:col-span-7">
            <p className={kicker}>Personal Training · 1:1 mit Boris</p>
            <h1 className="mt-5 font-display text-6xl uppercase leading-[0.85] tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">Dein Ziel.<br /><span className="text-primary">Mein Plan.</span><br />Garantiert.<span className="mt-4 block font-mono text-xs font-bold tracking-[0.22em] text-foreground/50 md:text-sm">Personal Training in Köln</span></h1>
            <p className="mt-6 max-w-xl text-lg font-bold leading-snug md:text-2xl">Assessment, Anamnese und dein Programm sind immer drin. Du erreichst dein Ziel, oder du bekommst dein Geld zurück.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={WA} target="_blank" rel="noopener noreferrer" onClick={() => contact("hero")} className="campaign-button inline-flex items-center justify-center gap-2 bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-white"><MessageCircle className="h-4 w-4" /> Termin anfragen</a>
              <a href="#preise" className="campaign-button inline-flex items-center justify-center gap-2 border-2 border-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">Preise <ArrowRight className="h-4 w-4" /></a>
            </div>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/50">Termin auf Anfrage · 45 oder 60 Minuten · Herzogstraße 16–20, Köln</p>
          </div>
          <div className="md:col-span-5">
            <div className="campaign-hero-creative relative">
              <img src="/img/manus/coach-boris-v2.jpg" alt="Boris korrigiert die Technik einer Athletin an der Langhantel" width={945} height={1176} className="relative z-10 block w-full border border-primary/40 object-cover" />
              <span className="campaign-outline-word hidden md:block">Coach</span>
            </div>
          </div>
        </div>
      </section>

      {/* Immer inklusive */}
      <section className="border-b border-foreground/10 py-16 md:py-24" id="inklusive">
        <div className="container">
          <p className={kicker}>In jeder Karte</p>
          <h2 className={`mt-4 ${h2}`}>Immer<br /><span className="text-primary">inklusive.</span></h2>
          <ul className="mt-10 grid gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-5">
            {INCLUDED.map(({ Icon, title, text }, i) => (
              <li key={title} className="bg-card p-6 md:p-7">
                <div className="flex items-center justify-between"><span className="font-mono text-xs text-foreground/40">0{i + 1}</span><span className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground"><Icon className="h-5 w-5" strokeWidth={2.2} /></span></div>
                <h3 className="mt-6 text-xl font-black uppercase leading-tight tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Für wen */}
      <section className="border-b border-foreground/10 bg-card py-16 md:py-24">
        <div className="container">
          <p className={kicker}>Für wen</p>
          <h2 className={`mt-4 ${h2}`}>Für Leute,<br /><span className="text-primary">die es ernst meinen.</span></h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {FOR.map(([t, x]) => <div key={t} className="border-l-4 border-primary bg-background p-6"><h3 className="text-2xl font-black uppercase tracking-tight">{t}</h3><p className="mt-2 text-foreground/70">{x}</p></div>)}
          </div>
        </div>
      </section>

      {/* Ablauf */}
      <section className="border-b border-foreground/10 py-16 md:py-24">
        <div className="container">
          <p className={kicker}>Ablauf</p>
          <h2 className={`mt-4 ${h2}`}>Vier Schritte<br /><span className="text-primary">zum Ziel.</span></h2>
          <ol className="mt-10 grid gap-px bg-primary md:grid-cols-4">
            {STEPS.map(([t, x], i) => <li key={t} className="border-t-4 border-primary bg-card p-6 md:p-7"><span className="font-display text-6xl leading-none text-primary">0{i + 1}</span><h3 className="mt-5 text-xl font-black uppercase leading-tight tracking-tight">{t}</h3><p className="mt-2 text-sm leading-relaxed text-foreground/65">{x}</p></li>)}
          </ol>
        </div>
      </section>

      {/* Preise */}
      <section className="scroll-mt-24 border-b border-foreground/10 bg-card py-16 md:py-24" id="preise">
        <div className="container">
          <p className={kicker}>Preise</p>
          <h2 className={`mt-4 ${h2}`}>Drei Karten.<br /><span className="text-primary">Ein Versprechen.</span></h2>
          <p className="mt-4 max-w-xl text-sm text-foreground/60">Assessment, Anamnese, Programm und Garantie sind in jeder Karte drin. Online kaufen oder erst reden, beides geht.</p>
          <div className="mt-10 grid gap-px bg-foreground/10 md:grid-cols-3">
            {pt.map(p => {
              const hi = !!p.popular;
              return (
                <div key={p.id} className={`relative flex flex-col p-7 md:p-8 ${hi ? "border-t-4 border-primary bg-primary/10" : "bg-background"}`}>
                  {hi && <span className="absolute right-4 top-4 bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-primary-foreground">Empfohlen</span>}
                  <h3 className="pr-24 text-2xl font-black uppercase tracking-tight">{p.name}</h3>
                  <p className="mt-1 text-xs font-black uppercase tracking-widest text-primary">{p.description}</p>
                  <div className="mt-5"><span className="font-mono text-5xl font-black">{shopPrice(p.price)}</span>{p.perUnit && <p className="mt-1 text-xs text-foreground/50">{p.perUnit}</p>}</div>
                  <ul className="mt-5 flex-1 space-y-2">{p.features.map(f => <li key={f} className="flex items-start gap-2 text-sm text-foreground/75"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
                  <a href={p.paymentLink || WA} target={p.paymentLink ? undefined : "_blank"} rel={p.paymentLink ? undefined : "noopener noreferrer"} onClick={() => buy(p.name, p.price)} className={`campaign-button mt-6 inline-flex items-center justify-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest ${hi ? "bg-primary text-primary-foreground hover:bg-white" : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`}>Jetzt kaufen <ArrowRight className="h-3.5 w-3.5" /></a>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-col items-start gap-3 border border-foreground/15 bg-background p-6 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-bold">Lieber erst reden? Termin auf Anfrage, ich melde mich persönlich.</p>
            <a href={WA} target="_blank" rel="noopener noreferrer" onClick={() => contact("preise")} className="campaign-button inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-white"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          </div>
          <p className="mt-4 text-xs text-foreground/45">Alle Preise inklusive Mehrwertsteuer. Bezahlung sicher über Stripe mit Apple Pay, Karte, SEPA oder Klarna.</p>
        </div>
      </section>

      {/* Coach */}
      <section className="border-b border-foreground/10 py-16 md:py-24">
        <div className="container grid gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-4"><img src="/img/manus/boris-portrait.jpg" alt="Boris, Gründer und Coach bei SKILL CGN" width={1024} height={1536} loading="lazy" className="block w-full border border-primary/40 object-cover" /></div>
          <div className="md:col-span-8">
            <p className={kicker}>Dein Coach</p>
            <h2 className={`mt-4 ${h2}`}>Ich trainiere<br /><span className="text-primary">dich selbst.</span></h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/80">Ich bin Boris, Gründer von SKILL CGN. Personal Training bei uns heißt: Ich stehe neben dir, nicht ein Trainer aus dem Dienstplan. Ich sehe deine Technik, ich kenne deine Zahlen aus dem Scan, und ich schreibe dein Programm selbst. Das Versprechen gebe ich, weil ich die Ergebnisse jeden Tag im Gym sehe.</p>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">Wenn du es ernst meinst, meine ich es auch ernst. Schreib mir.</p>
            <a href={WA} target="_blank" rel="noopener noreferrer" onClick={() => contact("coach")} className="campaign-button mt-8 inline-flex items-center gap-2 bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-white"><MessageCircle className="h-4 w-4" /> Termin anfragen</a>
          </div>
        </div>
      </section>

      {/* Garantie */}
      <section className="bg-primary py-16 text-primary-foreground md:py-24" id="garantie">
        <div className="container grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
          <span className="flex h-24 w-24 items-center justify-center bg-black text-primary md:h-32 md:w-32"><ShieldCheck className="h-[55%] w-[55%]" strokeWidth={2} /></span>
          <div>
            <p className="inline-block bg-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Erfolgsversprechen</p>
            <h2 className={`mt-4 ${h2}`}>Ziel erreicht.<br />Oder Geld zurück.</h2>
            <p className="mt-6 max-w-2xl text-lg font-bold leading-snug md:text-2xl">Im Assessment legen wir dein Ziel fest, messbar und mit Datum. Du machst deine Einheiten, ich mache den Rest. Steht das Ziel am Ende der Karte nicht, bekommst du den Kartenpreis zurück.</p>
            <p className="mt-5 max-w-2xl text-xs font-bold leading-relaxed text-black/70">Gilt für 5er- und 10er-Karte, wenn alle Einheiten innerhalb des vereinbarten Zeitraums absolviert wurden. Ziel und Zeitraum halten wir nach dem Assessment schriftlich fest.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-foreground/10 py-16 md:py-24">
        <div className="container max-w-3xl">
          <p className={kicker}>Fragen</p>
          <h2 className={`mt-4 ${h2}`}>Kurz<br /><span className="text-primary">beantwortet.</span></h2>
          <dl className="mt-10 divide-y divide-foreground/10 border-y border-foreground/10">
            {FAQ.map(([q, a]) => <div key={q} className="py-5"><dt className="text-lg font-black uppercase tracking-tight">{q}</dt><dd className="mt-2 text-foreground/70">{a}</dd></div>)}
          </dl>
        </div>
      </section>

      {/* Abschluss */}
      <section className="py-16 md:py-24">
        <div className="container text-center">
          <h2 className={h2}>Schreib mir.<br /><span className="text-primary">Der Rest ist mein Job.</span></h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={WA} target="_blank" rel="noopener noreferrer" onClick={() => contact("ende")} className="campaign-button inline-flex items-center justify-center gap-2 bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-white"><MessageCircle className="h-4 w-4" /> Termin anfragen</a>
            <Link to="/shop" className="campaign-button inline-flex items-center justify-center gap-2 border-2 border-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">Alle Tickets im Shop <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
