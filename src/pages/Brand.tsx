import Hero from "@/components/Hero";
import { usePageMeta } from "@/lib/meta";

/* Brand Book, Text 1:1 aus reference-site/brand.html */
export default function Brand() {
  usePageMeta("Brand Book — SKILL CGN", "Das Markensystem von SKILL CGN. Farben, Schriften, Logo, Tonalität, Fotografie, Angebote, Anzeigen.", "noindex,nofollow");
  return (
    <>
      <Hero kick="Brand Book · Version 4 · September 2026" title={<>This is<br /><span className="text-yellow">the system.</span></>} className="!pb-12"
        lead="Eine Marke, ein Gelb, keine Ausnahmen. Dieses Buch gilt für alle, die für SKILL CGN gestalten, schreiben, fotografieren oder Anzeigen schalten. Es ersetzt alle früheren Versionen." />

      <section className="sec bb"><div className="wrap">
        <h2>01 Wer wir sind</h2>
        <p><b>SKILL CGN ist Kölns Performance Studio.</b> Gecoachtes Training für HYROX, Strength und Conditioning in der Kölner Innenstadt. Kein Fitnessstudio mit Kursen, sondern ein Trainingsort mit Gym.</p>
        <h3>Für wen</h3>
        <ul>
          <li><b>Der Aufsteiger.</b> 25 bis 45, trainiert schon, will messbar besser werden, sucht Struktur und Coaching statt Geräte allein.</li>
          <li><b>Der Wettkämpfer.</b> Hat HYROX oder ATHX im Kalender, braucht Race Prep, Pacing, ein Team.</li>
          <li><b>Der Umsteiger.</b> Kommt über Urban Sports in die Kurse, merkt nach ein paar Wochen, dass er mehr will.</li>
        </ul>
        <h3>Nicht für</h3>
        <ul>
          <li>Menschen, die ein günstiges Gym zum Alleintrainieren suchen.</li>
          <li>Menschen, die Wellness, Sauna oder Pool erwarten.</li>
          <li>Menschen, die betreut werden wollen, ohne selbst zu arbeiten.</li>
        </ul>
        <h3>Das Versprechen</h3>
        <p>Du bekommst Coaching, Struktur und einen messbaren Startpunkt. Was du daraus machst, ist deine Arbeit. <b>Show up. Earn it.</b></p>
        <h3>Was uns unterscheidet</h3>
        <ul>
          <li><b>Coaching in jeder Class.</b> Korrektur, Progression, Ansprache mit Namen.</li>
          <li><b>Messbarkeit.</b> 3D Körperscan, Watt auf den Ergometern, Zeiten auf der Bahn.</li>
          <li><b>Ein System.</b> SKILL als Basis, HYROX oder RAW als Spezialisierung, ATHX als Prüfung.</li>
          <li><b>Official HYROX Gym.</b> Kein Boutique Studio, das HYROX auf den Plan schreibt.</li>
        </ul>

        <h2>02 Die Philosophie</h2>
        <ul>
          <li><b>Show, don't explain.</b> Ein Bild, ein Satz. Schwache Marken erklären sich, starke existieren.</li>
          <li><b>One asset, one message.</b> Eine Story hat genau eine Botschaft. Nicht alle Kurse von heute, sondern HYROX 18:00.</li>
          <li><b>English for impact, Deutsch für Details.</b> Claims, Headlines, Social und Anzeigen auf Englisch. Website, Verträge, Tarife, FAQ und Kundenkommunikation auf Deutsch.</li>
          <li><b>Das Logo ist der Held.</b> Das S Icon ist unser Swoosh. Groß, hart, oft als einziges grafisches Element.</li>
          <li><b>Inklusiv, nicht weich.</b> Jeder kann anfangen. Niemand wird bespaßt.</li>
        </ul>

        <h2>03 Farben</h2>
        <p><b>70 Prozent Dunkel, 20 Prozent Weiß, 10 Prozent Gelb.</b> Gelb ist ein Skalpell, kein Pinsel. Es markiert genau eine Priorität pro Komposition. Nie als Fläche, nie als Hintergrund, nie zweimal auf einem Bild.</p>
        <div className="sw">
          <div className="bg-yellow text-black"><b>#FBFF00</b><small>SKILL Yellow. Der einzige Akzent.</small></div>
          <div className="bg-black text-white"><b>#000000</b><small>Deep Black. Grundfläche für 90 Prozent aller Assets.</small></div>
          <div className="bg-white text-black"><b>#FFFFFF</b><small>Pure White. Headlines und Logo auf Dunkel.</small></div>
          <div className="bg-anthracite text-white"><b>#2A3133</b><small>Anthracite. Karten, Boxen, zweite Fläche.</small></div>
          <div className="bg-muted text-white"><b>#4A4F54</b><small>Muted. Zweittext, Rahmen, Labels.</small></div>
          <div className="bg-line text-white"><b>#1E2224</b><small>Border. Trennlinien.</small></div>
        </div>
        <h3>Verboten</h3>
        <ul>
          <li>Rot, Grün, Orange, Blau. Nie. Auch nicht für Ausverkauft, Verfügbar oder WhatsApp.</li>
          <li>Jedes andere Gelb. Nicht #F1FE57, nicht #FFE000. Nur #FBFF00.</li>
          <li>Verläufe, Schatten, Glow.</li>
        </ul>

        <h2>04 Typografie</h2>
        <p>Drei Schriften, drei Rollen, keine Ausnahmen. Alle bei Google Fonts, kostenlos.</p>
        <div className="type">
          <div><span className="d">Bebas Neue</span><br /><small className="mute">Display. Headlines, Claims, Zahlen im Hero. Immer Versalien. Zeilenabstand 0,9.</small></div>
          <div><span className="b">Space Grotesk. Strukturiertes Training. Professionelles Coaching. Messbare Ergebnisse.</span><br /><small className="mute">Body. Fließtext, UI, Buttons. Regular für Text, Bold für Buttons und Zwischentitel.</small></div>
          <div><span className="m">#FBFF00 · 39 € / 4 WOCHEN · 18:00 UHR · 0 € STARTGEBÜHR</span><br /><small className="mute">IBM Plex Mono. Preise, Zeiten, Laufzeiten, technische Angaben, Labels.</small></div>
        </div>
        <h3>Regeln</h3>
        <ul>
          <li>Headlines links, nie zentriert. Maximal zwei Zeilen. Ein Wort oder eine Zeile in Gelb, nie mehr.</li>
          <li>Zeilenlänge im Fließtext unter 80 Zeichen.</li>
          <li>Keine Versalien in Labels über Inhalten. Keine dekorativen Nummern, wenn keine Reihenfolge dahinter steht.</li>
        </ul>

        <h2>05 Logo</h2>
        <p><b>Nur Originaldateien. Nie nachbauen.</b> Kein Nachsetzen mit einer Schrift, keine Effekte, keine Verzerrung, keine Umrandung.</p>
        <div className="logos">
          <div className="bg-black"><img src="/img/logo-white.svg" alt="SKILL CGN weiß" /></div>
          <div className="bg-black"><img src="/img/favicon.svg" alt="S Icon gelb" className="!max-h-[70px]" /></div>
          <div className="bg-white"><img src="/img/logo-black.svg" alt="SKILL CGN schwarz" /></div>
        </div>
        <ul>
          <li><b>Primär</b> Wortmarke SKILL CGN in Weiß auf Schwarz. Gelb nur, wenn sonst kein Gelb im Bild ist.</li>
          <li><b>Sekundär</b> Wortmarke in Schwarz auf Weiß, für Druck und helle Flächen.</li>
          <li><b>S Icon</b> allein auf Textilien, Favicon, App. Als Hintergrund mit 5 bis 15 Prozent Deckkraft, nie zentriert, immer angeschnitten oder versetzt.</li>
          <li><b>Schutzraum</b> mindestens die Höhe des S auf allen Seiten.</li>
          <li><b>Mindestgröße</b> Wortmarke 120 Pixel breit, S Icon 24 Pixel.</li>
        </ul>

        <h2>06 Tonalität</h2>
        <p><b>Autoritär. Direkt. Coachlike.</b> Wir bitten nicht um Mitglieder. Wir fordern Leistung. Du wird klein geschrieben, wir duzen immer.</p>
        <div className="dd">
          <div className="col col-yes"><h3>So klingen wir</h3><ul>
            <li>Show up.</li><li>Earn it.</li><li>Put in the work.</li><li>Race day prep.</li><li>Not just access.</li><li>Strukturiertes Training. Professionelles Coaching.</li><li>Messbare Ergebnisse.</li><li>39 € alle vier Wochen, monatlich kündbar, keine Gebühr.</li><li>Dein Startplan übersetzt deinen Startpunkt in klare nächste Schritte.</li>
          </ul></div>
          <div className="col col-no"><h3>So nie</h3><ul>
            <li>Wir freuen uns auf dich!</li><li>Komm vorbei und probiere es aus</li><li>Deine Fitness Reise beginnt hier</li><li>Werde Teil unserer Community</li><li>Jetzt durchstarten</li><li>Struktur statt planlos</li><li>Ausrufezeichen. Mehr als eins pro Text ist eins zu viel.</li><li>Emojis in Anzeigen, Headlines und auf der Website.</li>
          </ul></div>
        </div>
        <h3>Vier Kanäle, vier Stimmen</h3>
        <ul>
          <li><b>Website.</b> Deutsch, sachlich, vollständig. Jede Zahl stimmt mit Magicline überein. Keine Preisangabe ohne Laufzeit.</li>
          <li><b>Anzeigen und Social.</b> Englisch, kurz, ein Satz. Kein Preis ohne Angebot, kein Angebot ohne Ablaufdatum.</li>
          <li><b>WhatsApp und E-Mail an Interessenten.</b> Deutsch, direkt, mit Vornamen, eine Frage pro Nachricht, Antwort innerhalb von zwei Stunden in der Öffnungszeit. Signatur Boris, SKILL Cologne.</li>
          <li><b>Mitgliederverwaltung.</b> Deutsch, knapp, verbindlich. Kündigungen werden bestätigt, nicht diskutiert.</li>
        </ul>

        <h2>07 Angebotsarchitektur</h2>
        <p>Ein Einstieg, drei Tarife, eine Rückholung. Mehr nicht. Jedes weitere Angebot verwässert.</p>
        <ul>
          <li><b>START 39.</b> Der einzige Einstieg für Neukunden. 39 € je 4 Wochen, 4 Classes je 4 Wochen, monatlich kündbar, keine Gebühr. Nur online, nur Neukunden. Jede Anzeige führt hierhin.</li>
          <li><b>SKILL Mitgliedschaft, SKILL Unlimited.</b> Zwei Tarife, zwei Laufzeiten (12 Monate oder monatlich). Der Unterschied ist die Anzahl der Classes, Scan-Rhythmus, Coach Gespräch und Parken, nie die Ausstattung.</li>
          <li><b>BACK 39.</b> Rückholung ehemaliger Mitglieder. Gleiche Mechanik wie START 39, plus kostenloser Scan.</li>
          <li><b>Urban Sports.</b> Zugang zu den Kursen, nicht zum Gym. Wird nie beworben, nie schlecht gemacht, immer als Weg zur Mitgliedschaft behandelt.</li>
          <li><b>Day Pass.</b> 25 € für Besucher von außerhalb, inklusive Kurs. Nicht für Kölner, die bekommen das Probetraining.</li>
        </ul>

        <h2>08 Fotografie</h2>
        <p><b>Real. Raw. Intense.</b> Dunkel, hart, unterbelichtet. Aktion, nicht Pose. Schweiß, Fokus, Anstrengung. Volle Classes als Beweis.</p>
        <div className="dd">
          <div className="col col-yes"><h3>So</h3><ul><li>Hartes Licht von oben oder seitlich, tiefe Schatten</li><li>Asymmetrisch, angeschnitten, das Motiv muss nicht ganz im Bild sein</li><li>Entsättigt, Schwarz zugezogen, Gelb an Geräten darf leuchten</li><li>Macro. Hand am Kettlebell, Fuß auf dem SkillRun</li><li>Coach korrigiert Athlet</li><li>Volle Class, Boomerang oder Reel, ohne Text</li></ul></div>
          <div className="col col-no"><h3>Nie</h3><ul><li>Stockfotos, KI generierte Menschen oder Räume</li><li>Vorher Nachher Körperbilder</li><li>Lächeln in die Kamera, Posen</li><li>Hell, überbelichtet, warme Filter</li><li>Wellness Ästhetik, Kerzen, weiches Licht</li></ul></div>
        </div>

        <h2>09 Layout und Web</h2>
        <ul>
          <li><b>Null Rundungen.</b> Keine Pill Buttons, keine runden Karten. Alles hat Kanten.</li>
          <li><b>Linkslastig.</b> Inhalt zieht nach links, Akzente nach rechts. Nichts zentrieren.</li>
          <li><b>Raster.</b> Maximalbreite 1180 Pixel, Innenabstand 20 Pixel mobil, Sektionen mit 72 Pixel Luft, Trennung durch 1 Pixel Linien, nicht durch Farbe.</li>
          <li><b>Buttons.</b> Primär Gelb mit schwarzer Schrift. Sekundär Weiß umrandet. Nie zwei gelbe Buttons nebeneinander.</li>
          <li><b>Bewegung.</b> Keine Einflug Animationen. Bewegung nur als Antwort auf eine Aktion.</li>
          <li><b>Mobil zuerst.</b> Über 80 Prozent der Besucher kommen vom Handy, meist aus Instagram. Jede Seite wird zuerst auf 390 Pixel Breite geprüft.</li>
          <li><b>Jede Seite hat ein Ziel.</b> Startseite führt zu START 39 oder Probetraining. Nichts anderes bekommt einen gelben Button.</li>
        </ul>

        <h2>10 Social Media</h2>
        <p>Drei Inhaltstypen, eine Regel pro Typ. Format 9:16, 1080 mal 1920 Pixel, Hintergrund Schwarz, Headline Bebas Neue, Button Gelb ohne Radius.</p>
        <ul>
          <li><b>Brand Statement.</b> Ein echtes Foto, ein englischer Satz. Kein Button, keine Zeit, kein Preis. Beispiel SHOW UP.</li>
          <li><b>Course Push.</b> Schwarz, eine Class, eine Uhrzeit, ein Button. Beispiel 18:00 HYROX. 3 SPOTS LEFT. BOOK NOW.</li>
          <li><b>Proof.</b> Volle Class als kurzes Video. Kein Text. Beispiel SOLD OUT.</li>
        </ul>
        <h3>Rhythmus</h3>
        <ul>
          <li>Täglich eine Story, wöchentlich ein Reel aus einer Class, monatlich ein Brand Statement im Feed.</li>
          <li>Jede Story wird vor dem Posten auf Datum, Wochentag und Uhrzeit geprüft.</li>
        </ul>

        <h2>11 Anzeigen</h2>
        <ul>
          <li><b>Ein Angebot pro Kampagne.</b> START 39 für Neukunden. Nichts, was über Urban Sports auch zu haben ist.</li>
          <li><b>Nie Zugang bewerben.</b> Beworben wird Coaching, Scan, Plan, Programm. Zugang ist durch Urban Sports entwertet.</li>
          <li><b>Bezahlt vor gratis.</b> Kein Gratis Lead Formular. Wer nicht bereit ist, 39 € zu zahlen, ist kein Lead.</li>
          <li><b>Creative.</b> Echtes Foto oder Video aus dem Studio, ein englischer Claim, Preis in Mono. Landingpage ist immer start39.</li>
          <li><b>Messung.</b> Pixel mit Einwilligung, Kauf mit Wert. Die Wahrheit steht in Magicline, nicht im Ads Manager.</li>
        </ul>

        <h2>12 Textbausteine</h2>
        <h3>WhatsApp, Erstantwort auf Probetraining Anfrage</h3>
        <div className="tpl">{`Hi {Vorname}, danke für deine Nachricht.

Probetraining ist kostenlos, 60 Minuten mit einem Coach. Buch dir hier direkt einen Termin: skill-studios.com/probetraining

Trainierst du schon regelmäßig oder fängst du neu an?

Boris, SKILL Cologne`}</div>
        <h3>WhatsApp, Day Pass Anfrage auf Englisch</h3>
        <div className="tpl">{`Hi {Name}, thanks for reaching out.

Yes, we offer a day pass. It's 25 € and includes the gym plus any class running that day.

Which day works for you? I'll get you set up.

Boris, SKILL Cologne`}</div>
        <h3>E-Mail, Rückholung ehemaliger Mitglieder</h3>
        <div className="tpl">{`Betreff: Wir sind umgezogen. Und wir haben dich verloren.

Hi {Vorname},

beim Umzug in die Herzogstraße haben wir den Kontakt zu vielen von euch verloren. Das war unser Fehler, nicht deiner.

Das neue Studio steht. Technogym, vier Ergometer, 3D Scan, dieselben Coaches. Ich würde dich gern wiedersehen.

Für ehemalige Mitglieder gibt es BACK 39. 39 € alle vier Wochen, dauerhaft, monatlich kündbar, keine Gebühr. Und einen kostenlosen 3D Scan, damit du siehst, wo du stehst.

Hier geht es direkt zum Angebot: skill-studios.com/back39

Wenn du Fragen hast, antworte einfach auf diese Mail.

Boris
Founder, SKILL CGN`}</div>

        <h2>13 Nicht verhandelbar</h2>
        <ul>
          <li>Logo nie nachbauen.</li>
          <li>Nur #FBFF00.</li>
          <li>Keine Rundungen.</li>
          <li>Kein Rot, Grün, Orange, Blau.</li>
          <li>Eine Story, eine Botschaft.</li>
          <li>Nie zentrieren.</li>
          <li>Kein Preis ohne Laufzeit und Gebühr.</li>
          <li>Kein Angebot, das Urban Sports auch bietet.</li>
        </ul>
      </div></section>
    </>
  );
}
