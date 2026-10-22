import Hero from "@/components/Hero";
import { usePageMeta } from "@/lib/meta";

export default function KuendigungBestaetigt() {
  usePageMeta("Kündigung eingegangen — SKILL CGN", "Bestätigung deiner Kündigung.", "noindex,nofollow");
  return (
    <Hero kick="Kündigung" title="Eingegangen."
      lead="Deine Kündigung ist bei uns eingegangen. Du bekommst innerhalb weniger Minuten eine Bestätigung mit Datum und Uhrzeit des Eingangs an deine E-Mail-Adresse. Das Ende deiner Mitgliedschaft teilen wir dir darin ebenfalls mit.">
      <p className="mute mt-4">Keine E-Mail bekommen? Schreib an <a href="mailto:info@skill-studios.com" className="underline">info@skill-studios.com</a>.</p>
    </Hero>
  );
}
