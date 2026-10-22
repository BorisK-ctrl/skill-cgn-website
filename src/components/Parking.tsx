/*
 * Parken: Icon, Zeile in den Preiskarten, Sektion auf der Startseite (mit Skizze), Drei-Schritte-Block auf /memberships.
 * Texte und Regeln aus src/lib/tarife.ts (PARKING).
 */
import { Car, Footprints, LogIn, Ticket, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";
import { PARKING, parkingLabel } from "@/lib/tarife";

/** Auto mit P-Schild, als eine Marke in Gelb. */
export function ParkingIcon({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center bg-primary/10 text-primary ${className}`} aria-hidden="true">
      <Car className="h-[55%] w-[55%]" strokeWidth={2} />
      <span className="absolute -right-1.5 -top-1.5 flex h-[42%] w-[42%] items-center justify-center bg-primary font-mono text-[0.9em] font-black leading-none text-primary-foreground">P</span>
    </span>
  );
}

/** Zeile in jeder Preiskarte, immer an derselben Stelle. Inklusive = gelber Chip, 0 = grau, durchgestrichen. */
export function ParkingLine({ perWeek, dark = false }: { perWeek: 0 | 2 | 3; dark?: boolean }) {
  const none = perWeek === 0;
  if (none) {
    return (
      <p className={`mt-4 flex items-center gap-2 border-t pt-4 text-sm ${dark ? "border-white/10 text-white/35" : "border-foreground/10 text-foreground/35"}`}>
        <span className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center ${dark ? "bg-white/10 text-white/40" : "bg-foreground/10 text-foreground/40"}`} aria-hidden="true">
          <Car className="h-4 w-4" />
          <span className={`absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center font-mono text-[9px] font-black leading-none ${dark ? "bg-white/30 text-black" : "bg-foreground/30 text-background"}`}>P</span>
        </span>
        <span className="line-through decoration-2">{parkingLabel(0)}</span>
      </p>
    );
  }
  return (
    <div className={`mt-4 border-t pt-4 ${dark ? "border-white/10" : "border-foreground/10"}`}>
      <p className="flex items-center gap-3 bg-primary px-3 py-2.5 text-primary-foreground">
        <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center bg-black text-primary" aria-hidden="true">
          <Car className="h-[18px] w-[18px]" strokeWidth={2.2} />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-primary font-mono text-[10px] font-black leading-none text-black outline outline-2 outline-black">P</span>
        </span>
        <span className="leading-tight"><span className="block font-mono text-[10px] uppercase tracking-[0.18em]">Parken inklusive</span><span className="block text-sm font-black">{perWeek} × pro Woche, je 1 Stunde</span></span>
      </p>
    </div>
  );
}

/** Skizze: Studio, Parkhaus, Fußweg. Schematisch, nicht maßstäblich. */
export function ParkingSketch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 300" className={`w-full ${className}`} role="img" aria-label="Skizze: vom Parkhaus Brückenstraße zwei Minuten zu Fuß zu SKILL CGN in der Herzogstraße">
      <rect width="640" height="300" fill="#000" />
      {/* Straßen */}
      <g stroke="#2A3133" strokeWidth="26" strokeLinecap="square">
        <line x1="0" y1="190" x2="640" y2="190" />
        <line x1="130" y1="0" x2="130" y2="300" />
        <line x1="470" y1="0" x2="470" y2="300" />
        <line x1="130" y1="70" x2="640" y2="70" />
      </g>
      <g fill="#8a9398" fontFamily="IBM Plex Mono, monospace" fontSize="11" letterSpacing="1.5">
        <text x="150" y="207" textAnchor="start">HERZOGSTRASSE</text>
        <text x="150" y="87">BRÜCKENSTRASSE</text>
        <text x="482" y="150" transform="rotate(90 482 150)" textAnchor="middle">LUDWIGSTRASSE</text>
        <text x="12" y="150" transform="rotate(-90 12 150)" textAnchor="middle" fill="#5a6a6f">NEUMARKT</text>
      </g>
      {/* Studio */}
      <g>
        <rect x="190" y="215" width="190" height="62" fill="#111" stroke="#FBFF00" strokeWidth="3" />
        <text x="285" y="241" textAnchor="middle" fill="#FBFF00" fontFamily="Bebas Neue, sans-serif" fontSize="24" letterSpacing="1">SKILL CGN</text>
        <text x="285" y="262" textAnchor="middle" fill="#fff" fontFamily="IBM Plex Mono, monospace" fontSize="11" letterSpacing="1.5">HERZOGSTRASSE 16–20</text>
      </g>
      {/* Parkhaus */}
      <g>
        <rect x="490" y="24" width="130" height="124" fill="#111" stroke="#fff" strokeWidth="3" />
        <rect x="508" y="40" width="34" height="34" fill="#FBFF00" />
        <text x="525" y="66" textAnchor="middle" fill="#000" fontFamily="Bebas Neue, sans-serif" fontSize="30">P</text>
        <text x="555" y="104" textAnchor="middle" fill="#fff" fontFamily="Bebas Neue, sans-serif" fontSize="19" letterSpacing="1">PARKHAUS</text>
        <text x="555" y="122" textAnchor="middle" fill="#fff" fontFamily="Bebas Neue, sans-serif" fontSize="19" letterSpacing="1">BRÜCKENSTRASSE</text>
        <text x="555" y="140" textAnchor="middle" fill="#8a9398" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="1.5">LUDWIGSTRASSE 1</text>
      </g>
      {/* Fußweg */}
      <path d="M 490 110 L 455 110 L 455 175 L 380 175 L 380 215" fill="none" stroke="#FBFF00" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="490" cy="110" r="5" fill="#FBFF00" />
      <circle cx="380" cy="215" r="5" fill="#FBFF00" />
      <g transform="translate(398 150)">
        <rect x="0" y="0" width="118" height="26" fill="#FBFF00" />
        <text x="59" y="18" textAnchor="middle" fill="#000" fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="700" letterSpacing="1.5">2 MIN ZU FUSS</text>
      </g>
    </svg>
  );
}

/** Startseite: direkt unter den Preisen. Gelber Block, groß, nicht zu übersehen. */
export function ParkingSection() {
  const stats = [
    { big: "2", unit: "Min", label: "zu Fuß vom Parkhaus Brückenstraße" },
    { big: "1", unit: "Std", label: "je Besuch. Wir zahlen." },
    { big: `${PARKING.mitgliedschaft}–${PARKING.unlimited}`, unit: "×", label: "pro Woche, je nach Tarif" },
  ];
  return (
    <section className="relative overflow-hidden bg-primary text-black" id="parken">
      {/* Diagonale Streifen oben, wie ein Parkplatz-Markierung */}
      <div className="h-3 w-full" style={{ backgroundImage: "repeating-linear-gradient(135deg, #000 0 14px, transparent 14px 28px)" }} aria-hidden="true" />
      <span className="pointer-events-none absolute -right-6 -top-10 select-none font-display leading-none text-black/[0.07] text-[22rem] md:text-[34rem]" aria-hidden="true">P</span>
      <div className="container relative py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-[auto_1fr] md:items-start">
          <span className="relative inline-flex h-24 w-24 md:h-36 md:w-36 shrink-0 items-center justify-center bg-black text-primary" aria-hidden="true">
            <Car className="h-[55%] w-[55%]" strokeWidth={2} />
            <span className="absolute -right-2 -top-2 flex h-[42%] w-[42%] items-center justify-center bg-primary font-display text-[1.6em] md:text-[2.4em] leading-none text-black outline outline-[3px] outline-black">P</span>
          </span>
          <div>
            <p className="inline-block bg-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-4">Neu · ab SKILL Mitgliedschaft</p>
            <h2 className="font-display text-6xl md:text-8xl lg:text-9xl uppercase leading-[0.85] tracking-tight">Parken<br />inklusive.</h2>
            <p className="mt-5 max-w-xl text-lg md:text-2xl font-bold leading-snug">{PARKING.garage}, {PARKING.walk}. Du ziehst ein Ticket, trainierst, wir entwerten. Fertig.</p>
          </div>
        </div>
        <div className="mt-10 grid gap-px bg-black sm:grid-cols-3">
          {stats.map(st => (
            <div key={st.label} className="bg-primary p-6 md:p-8 border-2 border-black">
              <p className="font-display leading-none"><span className="text-7xl md:text-8xl">{st.big}</span><span className="ml-2 text-3xl md:text-4xl">{st.unit}</span></p>
              <p className="mt-3 text-sm md:text-base font-bold leading-snug">{st.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-12 md:items-center">
          <figure className="md:col-span-7 lg:col-span-6 border-4 border-black bg-black">
            <img src="/img/parken-karte.webp" width={1200} height={800} loading="lazy" alt="Karte: Parkhaus Brückenstraße, Ludwigstraße 1, zu SKILL CGN, Herzogstraße 16–20, zwei Minuten zu Fuß" className="block w-full h-auto" />
          </figure>
          <div className="md:col-span-5 lg:col-span-6 lg:pl-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-black/60">Der Weg</p>
            <ol className="mt-3 space-y-2 text-base md:text-lg font-bold leading-snug">
              <li className="flex gap-3"><span className="font-display text-2xl leading-none">01</span>{PARKING.garage}, Einfahrt {PARKING.address}.</li>
              <li className="flex gap-3"><span className="font-display text-2xl leading-none">02</span>Die Ludwigstraße runter, über den Perlenpfuhl in die Herzogstraße. {PARKING.walk}.</li>
              <li className="flex gap-3"><span className="font-display text-2xl leading-none">03</span>SKILL CGN, Herzogstraße 16–20. Ticket mitbringen.</li>
            </ol>
            <p className="mt-5 text-xs font-bold leading-relaxed text-black/70">{PARKING.smallPrint}</p>
            <Link to="/memberships#parken" className="campaign-button mt-4 inline-flex items-center gap-2 bg-black px-5 py-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-white hover:text-black">So funktioniert es <Footprints className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
      <div className="h-3 w-full" style={{ backgroundImage: "repeating-linear-gradient(135deg, #000 0 14px, transparent 14px 28px)" }} aria-hidden="true" />
    </section>
  );
}

/** /memberships: So funktioniert Parken in drei Schritten. */
export function ParkingSteps() {
  const icons = [Ticket, Dumbbell, LogIn];
  return (
    <section className="scroll-mt-24 border-t-8 border-primary bg-background py-20" id="parken">
      <div className="container">
        <div className="mb-10 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <ParkingIcon className="h-20 w-20 md:h-28 md:w-28 !bg-primary !text-black" />
          <div>
            <p className="inline-block bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-black mb-4">Parken inklusive · ab SKILL Mitgliedschaft</p>
            <h2 className="font-display text-6xl md:text-8xl uppercase leading-[0.85] tracking-tight">So funktioniert<br /><span className="text-primary">Parken.</span></h2>
            <p className="mt-4 max-w-xl text-base md:text-lg font-bold text-foreground/80">{PARKING.garage}, {PARKING.address}, {PARKING.walk}. {PARKING.mitgliedschaft} mal pro Woche in der Mitgliedschaft, {PARKING.unlimited} mal bei Unlimited, je 1 Stunde.</p>
          </div>
        </div>
        <ol className="grid gap-px bg-primary md:grid-cols-3">
          {PARKING.steps.map((s, i) => { const Icon = icons[i]; return (
            <li key={s.title} className="relative bg-card p-7 md:p-8 border-t-4 border-primary">
              <div className="flex items-start justify-between">
                <span className="font-display text-6xl leading-none text-primary">0{i + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center bg-primary text-black"><Icon className="h-5 w-5" strokeWidth={2.2} /></span>
              </div>
              <h3 className="mt-6 text-2xl font-black uppercase tracking-tight leading-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{s.text}</p>
            </li>
          ); })}
        </ol>
        <p className="mt-6 text-xs text-foreground/45 leading-relaxed">{PARKING.smallPrint}</p>
      </div>
    </section>
  );
}
