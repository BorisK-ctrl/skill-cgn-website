import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Hero from "@/components/Hero";
import Section from "@/components/Section";
import { usePageMeta } from "@/lib/meta";

/* Netlify Forms: das Formular ist zusätzlich statisch in index.html hinterlegt, damit Netlify es beim Build erkennt. */
export default function Kuendigung() {
  usePageMeta("Vertrag kündigen — SKILL CGN", "Kündige deine Mitgliedschaft online. Bestätigung per E-Mail.", "noindex,nofollow");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr("");
    const f = e.currentTarget;
    if (!f.checkValidity()) { f.reportValidity(); return; }
    setBusy(true);
    try {
      const body = new URLSearchParams(new FormData(f) as unknown as Record<string, string>).toString();
      const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (!r.ok) throw new Error("HTTP " + r.status);
      navigate("/kuendigung-bestaetigt");
    } catch {
      setBusy(false);
      setErr("Das Absenden hat nicht geklappt. Bitte versuch es noch einmal oder schick deine Kündigung an info@skill-studios.com.");
    }
  }

  return (
    <>
      <Hero kick="Kündigung" title={<>Vertrag<br />kündigen.</>} lead="Hier kündigst du deine Mitgliedschaft online. Du bekommst sofort eine Bestätigung an deine E-Mail-Adresse." />
      <Section>
        <form name="kuendigung" method="POST" data-netlify="true" data-netlify-honeypot="website" onSubmit={submit} noValidate>
          <input type="hidden" name="form-name" value="kuendigung" />
          <p className="hidden"><label>Website <input name="website" /></label></p>
          <label className="label" htmlFor="name">Vor- und Nachname</label><input className="input" id="name" name="name" required autoComplete="name" />
          <label className="label" htmlFor="email">E-Mail-Adresse, die bei uns hinterlegt ist</label><input className="input" id="email" name="email" type="email" required autoComplete="email" />
          <label className="label" htmlFor="mnr">Mitgliedsnummer, falls bekannt</label><input className="input" id="mnr" name="mitgliedsnummer" />
          <label className="label" htmlFor="zahlungsart">Wie zahlst du deinen Beitrag?</label>
          <select className="input" id="zahlungsart" name="zahlungsart" defaultValue="sepa">
            <option value="sepa">SEPA-Lastschrift (Magicline)</option>
            <option value="karte">Karte, Apple Pay oder Google Pay (Stripe-Abo)</option>
            <option value="unbekannt">Weiß ich nicht</option>
          </select>
          <label className="label" htmlFor="art">Art der Kündigung</label>
          <select className="input" id="art" name="art" required defaultValue="ordentlich">
            <option value="ordentlich">Ordentliche Kündigung zum nächstmöglichen Termin</option>
            <option value="ausserordentlich">Außerordentliche Kündigung aus wichtigem Grund</option>
          </select>
          <label className="label" htmlFor="datum">Gewünschtes Kündigungsdatum, optional</label><input className="input" id="datum" name="datum" type="date" />
          <label className="label" htmlFor="grund">Grund, nur bei außerordentlicher Kündigung</label><textarea className="input" id="grund" name="grund" rows={4} />
          <div className="btns"><button className="btn" type="submit" disabled={busy}>{busy ? "Wird gesendet …" : "Jetzt kündigen"}</button></div>
          {err && <p className="err" role="alert">{err}</p>}
          <p className="text-sm mute mt-4">Mit dem Absenden erklärst du die Kündigung deiner Mitgliedschaft bei der Impetus Kraftkonzept UG. Es gilt die Kündigungsfrist deines Vertrags.</p>
        </form>
      </Section>
    </>
  );
}
