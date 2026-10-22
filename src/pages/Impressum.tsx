import { usePageMeta } from "@/lib/meta";

/* Text 1:1 aus reference-site/impressum.html */
export default function Impressum() {
  usePageMeta("Impressum — SKILL CGN", "Impressum der Impetus Kraftkonzept UG.", "noindex,nofollow");
  return (
    <section className="sec legal"><div className="wrap">
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>Impetus Kraftkonzept UG (haftungsbeschränkt)<br />Geschäftsanschrift: Turiner Straße 10, 50668 Köln<br />Studio: Herzogstraße 16–20, 50667 Köln</p>
      <p>Vertreten durch den Geschäftsführer: Boris Kurowski</p>
      <h2>Kontakt</h2>
      <p>Telefon: +49 221 70093636<br />E-Mail: info@skill-studios.com</p>
      <h2>Registereintrag</h2>
      <p>Registergericht: Amtsgericht Köln<br />Handelsregisternummer: HRB 781645</p>
      <h2>Umsatzsteuer</h2>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE369181654</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </div></section>
  );
}
