import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Hero from "@/components/Hero";
import Section from "@/components/Section";
import Faq from "@/components/Faq";
import ProbetrainingBooking from "@/components/ProbetrainingBooking";
import { usePageMeta } from "@/lib/meta";
import { FaqJsonLd } from "@/lib/jsonld";
import { track } from "@/lib/pixel";
import { trackEvent } from "@/lib/events";
import { createLead, GOOGLE_BOOKING, WHATSAPP } from "@/lib/magicline";

const PROBETRAINING_FAQ: [string, string][] = [
  ["Wann soll ich da sein?", "Zu deiner gebuchten Uhrzeit. In den 30 Minuten machen wir das Erstgespräch und den 3D Scan."],
  ["Was passiert beim 3D Scan?", "Der Scaneca Scan dauert wenige Minuten. Du bekommst Körperfett, Muskelmasse und Haltung als Zahlen, der Coach erklärt dir, was sie bedeuten."],
  ["Was soll ich mitbringen?", "Sportkleidung und saubere Sportschuhe. Handtuch und Getränke bekommst du von uns."],
  ["Ich habe keine Erfahrung. Geht das?", "Ja. Das Probetraining ist genau dafür da. Der Coach passt alles an dein Level an."],
  ["Ich habe eine Verletzung oder Einschränkung.", "Sag es dem Coach vorher. Wir finden Übungen, die passen, oder sagen dir ehrlich, wenn etwas nicht geht."],
  ["Kann ich den Termin verschieben?", "Ja, kurz per WhatsApp oder als Antwort auf die Bestätigungsmail."],
];

/*
 * Probetraining (30 Minuten mit Coach). Kalender zuerst (ProbetrainingBooking): freie Zeiten live aus unseren Google-Kalendern, Uhrzeit wählen,
 * dann Daten. Ohne Google-Anbindung derselbe Kalender mit Wunschterminen (Team bestätigt per Mail, Lead in Magicline wie bisher).
 * Nur wenn auch das nicht lädt, der alte Weg: Formular → Lead in Magicline → Weiterleitung zur Google-Terminseite.
 */
export default function Probetraining() {
  usePageMeta("Kostenloses Probetraining in Köln mit 3D Scan — SKILL CGN", "30 Minuten mit Coach, 3D Körperscan inklusive. Du siehst deinen Startpunkt in Zahlen. Kostenlos, unverbindlich. Jetzt Termin wählen.");
  useEffect(() => { track("ViewContent", { content_name: "Probetraining" }); }, []);
  const [busy, setBusy] = useState(false);

  /* Rückfall ohne eigenen Kalender: Lead anlegen, dann Google-Terminseite */
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.checkValidity()) { f.reportValidity(); return; }
    setBusy(true);
    const d = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
    // Lead anlegen. Ein Fehler hier darf die Terminwahl nicht blockieren.
    try {
      await createLead({ firstname: d.firstname.trim(), lastname: d.lastname.trim(), email: d.email.trim(), phone: d.phone.trim(),
        notes: `Probetraining über Website. PLZ ${d.plz.trim()}. Urban Sports Club: ${d.usc}. Terminwahl über Google Kalender.` });
    } catch (err) { console.warn("lead", err); }
    /* Absprung zu Google Calendar zählt als Lead (Näherungswert): Google Calendar bietet keine Rücksprung-URL nach der Terminwahl. */
    track("Lead", { content_name: "Probetraining" });
    track("Schedule", { content_name: "Probetraining" });
    trackEvent("probetraining_calendar_open", { content_name: "Probetraining" });
    try { sessionStorage.setItem("skill-lead", JSON.stringify(d)); } catch {}
    window.location.href = GOOGLE_BOOKING;
  }

  const fallback = (
    <>
      <p className="lead mute">Kurz eintragen, dann wählst du im nächsten Schritt Tag und Uhrzeit. Bestätigung kommt sofort per E-Mail.</p>
      <form onSubmit={submit} noValidate className="mt-4">
        <label className="label" htmlFor="vn">Vorname</label><input className="input" id="vn" name="firstname" required autoComplete="given-name" />
        <label className="label" htmlFor="nn">Nachname</label><input className="input" id="nn" name="lastname" required autoComplete="family-name" />
        <label className="label" htmlFor="em">E-Mail</label><input className="input" id="em" name="email" type="email" required autoComplete="email" />
        <label className="label" htmlFor="tel">Handynummer</label><input className="input" id="tel" name="phone" type="tel" required autoComplete="tel" placeholder="+49 …" />
        <label className="label" htmlFor="plz">Postleitzahl</label><input className="input" id="plz" name="plz" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required autoComplete="postal-code" placeholder="50667" />
        <p className="label">Trainierst du über Urban Sports Club?</p>
        <div className="radio-row">
          <label><input type="radio" name="usc" value="nein" required />Nein</label>
          <label><input type="radio" name="usc" value="ja" />Ja</label>
        </div>
        <p className="text-sm mute mt-4">Mit dem Absenden stimmst du zu, dass wir dich zu deinem Probetraining per E-Mail und Telefon kontaktieren. <Link to="/datenschutz" className="underline">Datenschutz</Link></p>
        <div className="btns"><button className="btn" type="submit" disabled={busy}>{busy ? "Einen Moment …" : "Weiter zur Terminwahl"}</button></div>
      </form>
    </>
  );

  return (
    <>
      <Hero kick="Kostenlos und unverbindlich" title={<>Probe-<br />training <span className="text-primary">in Köln.</span></>}
        lead="30 Minuten mit Coach, 3D Körperscan inklusive. Du siehst deinen Startpunkt in Zahlen und bekommst einen Plan, der zu dir passt. Keine Zahlung, keine Bindung.">
        <div className="btns"><a className="btn" href="#buchen">Termin wählen</a><a className="btn-ghost" href={`${WHATSAPP}?text=${encodeURIComponent("Hallo, ich möchte ein Probetraining buchen.")}`} rel="noopener">Per WhatsApp anfragen</a></div>
      </Hero>

      <Section id="buchen">
        <h2>Termin wählen.</h2>
        <ProbetrainingBooking fallback={fallback} />
      </Section>

      <Section variant="panel">
        <h2>Gut zu wissen.</h2>
        <Faq items={PROBETRAINING_FAQ} />
        <FaqJsonLd items={PROBETRAINING_FAQ} />
      </Section>
    </>
  );
}
