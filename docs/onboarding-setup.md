# Termin-Kalender: Onboarding (Dankeseite, /onboarding) und Probetraining (/probetraining)

Stand 2026-11-18. Nach jedem Abschluss einer Mitgliedschaft (Black Week, START 39, BACK 39, Mitgliedschaften) bucht der Kunde seinen Onboarding-Termin direkt auf der Dankeseite. Das Onboarding dauert 90 Minuten: 3D-Scan, Bändchen, Trainingsplan, Einweisung. Die freien Zeiten kommen live aus unseren Google-Kalendern. Der Termin landet im Kalender **Onboarding**, Kunde und Team bekommen eine Mail. Wer die Dankeseite verlässt, bucht später über den persönlichen Link in der Willkommensmail (`/onboarding?t=…`).

Probetraining (30 Minuten) nutzt dieselbe Logik und dieselben Kalender (`KINDS` in `netlify/functions/lib/onboarding.ts`). Auf /probetraining stehen die freien Zeiten sofort oben (`/api/probetraining/slots`, öffentlich, höchstens 15 Sekunden alt). Der Kunde tippt eine Uhrzeit an, trägt dann Name, E-Mail, Telefon, PLZ und Urban Sports Club ein und bucht. Der Termin landet im Kalender **Probetraining**, der Lead in Magicline (mit der gebuchten Zeit). Ohne Google-Anbindung leitet die Seite wie bisher zur Google-Terminseite weiter.

Schutz beim Probetraining (jeder kann sich selbst einen Buchungszugang ausstellen, die E-Mail ist nicht bestätigt):
- Ist für eine E-Mail schon ein Probetraining eingetragen, nennt die Seite weder Zeit noch Coach. Die Bestätigung geht stattdessen noch einmal an die hinterlegte Adresse (höchstens einmal am Tag).
- Je Person ein Probetraining: `anna+2@…` und Gmail-Varianten mit Punkten zählen als dieselbe Adresse.
- Namen nur mit Buchstaben, Leerzeichen, Bindestrich, Apostroph (keine Links in der Bestätigungsmail).
- Bremsen je Anschluss (IPv6 je /64): 6 Zugänge pro Stunde, 5 Buchungsversuche pro Tag, 600 Abrufe der freien Zeiten pro Stunde. Zugänge gelten 2 Stunden.

**Wichtig nach dem Einschalten:** Die alte Google-Terminseite für Probetrainings (Terminplan in info@) kennt die Onboardings und Probetrainings der Website nicht. Sie kann einen Coach doppelt belegen. Deshalb nach dem ersten erfolgreichen Test die Terminseite in Google Kalender deaktivieren. Bis dahin liest die Website ihre Buchungen aus info@ mit und plant drumherum.

## Ohne Google-Zugang: Wunschtermin (seit 19.11.2026)

Solange die Google-Werte in Netlify fehlen (oder Google gerade nicht antwortet), zeigen Dankeseiten und /onboarding trotzdem den Kalender, nicht WhatsApp. Der Kunde wählt einen **Wunschtermin**, das Team bestätigt.

- Uhrzeiten: feste Fenster aus den echten Schichten (`WEEK` in `netlify/functions/lib/anfrage.ts`): Mo 9:00 bis 10:00, Di 14:00 bis 16:30, Mi 14:00 bis 15:00, Do 9:00 und 14:00 bis 16:30, Fr 9:00, 9:30 und 14:00 bis 17:30 (Start, 90 Minuten). Frühestens 30 Stunden im Voraus, drei Wochen sichtbar, 24. bis 26.12., 31.12. und 1.1. gesperrt.
- Absenden: `/api/onboarding/anfrage`. Auf der Dankeseite kommen Name, E-Mail und Telefon aus dem Kauf (Zeit antippen, absenden). Auf /onboarding trägt der Kunde sie ein, Vertragsnummer und Anmerkung optional.
- Mail ans Team (info@), Betreff "Onboarding-Anfrage: Name, Tag Uhrzeit, bitte bestätigen", mit zwei Knöpfen: **In Kalender eintragen** (Google Kalender, Kalender Onboarding wählen) und **Bestätigung schreiben** (fertige Mail an den Kunden). Antworten auf die Teammail gehen direkt an den Kunden.
- Mail an den Kunden: Wunschtermin, "wir bestätigen innerhalb von 24 Stunden", was ihn erwartet, App.
- **Es entsteht kein Kalendereintrag.** Zwei Kunden können dieselbe Zeit anfragen. Das Team bestätigt oder schlägt die nächste freie Zeit vor.
- Die Willkommensmail verlinkt ohne Google-Zugang https://skill-studios.com/onboarding statt WhatsApp.

Sobald Google eingerichtet ist, zeigt derselbe Kalender automatisch echte freie Zeiten und bucht sofort. Am Code muss dafür nichts geändert werden.

## Regel für freie Zeiten

Onboardings machen Peter, Nic, Noah und Boris (`STAFF` in `netlify/functions/lib/onboarding.ts`). Ein Start ist buchbar, wenn mindestens einer von ihnen

1. im Kalender **SERVICE** eine Schicht hat, die den ganzen Termin abdeckt. Als Schicht zählt nur ein Eintrag mit Uhrzeit, dessen Titel nur der Name ist, optional mit "Service" oder "Schicht" ("Peter", "Noah", "Nic Service"),
2. in der Zeit keinen eigenen Kurs gibt (Kalender **SKILL Classes** und **Classes**, beide, weil sie voneinander abweichen),
3. nicht abwesend ist: ganztägiger SERVICE-Eintrag ("Nic Uni"), jeder SERVICE-Eintrag mit seinem Namen, der keine reine Schicht ist ("Nic Uni 8-13", "Peter Arzt"), Kalender Urlaub und Urlaub Coaches,
4. keinen anderen Termin hat: Onboarding, Probetraining, Personal Training, Erstgespräch, Six Week onboarding, **info@** (dort landen die Buchungen der Google-Terminseite) und sein eigener Kalender (Boris: boris.k@, nur frei/belegt).

Grundsatz: lieber eine freie Zeit zu wenig anbieten als eine belegte.

- Ein Termin ohne sicheren Coach (kein Gast, keine Zeile "Coach:") belegt zusätzlich einen der freien Coaches. Angeboten wird dann nur, wenn danach noch ein Coach frei ist, und die Teammail sagt "Bitte prüfen". **Tipp: Coach als Gast in den Termin eintragen, dann ist es eindeutig.**
- Eine Abwesenheit oder ein ganztägiger SERVICE-Eintrag ohne erkennbaren Namen ("Studio geschlossen") blockt alle.
- Kurse anderer Coaches (Antonia/Toni, Mario, Saidu, Fabian …) blocken niemanden. Kommt ein neuer Coach dazu, seinen Vornamen in `OTHERS` ergänzen, sonst blockt sein Kurs vorsichtshalber einen unserer Coaches.
- Raster 30 Minuten, Onboarding frühestens 12 Stunden, Probetraining frühestens 3 Stunden im Voraus, drei Wochen sichtbar. Wer keine Schicht in SERVICE hat, ist nicht buchbar.
- Je E-Mail ein Onboarding und ein Probetraining. Ist der Termin vorbei, bucht der Link keinen neuen (dann WhatsApp). /api/probetraining/start nimmt höchstens 6 Anfragen je IP und Stunde an.

Immer aktuell: Jede Abfrage liest die Kalender frisch (kein Zwischenspeicher), die offene Seite lädt jede Minute neu und sofort beim Zurückkehren in den Tab. Löscht ihr einen Kurs, ist die Lücke beim nächsten Laden buchbar.

Schutz gegen Doppelbuchungen: Je Kunde läuft nur eine Buchung gleichzeitig. Zwei Buchungen, die sich zeitlich überschneiden, laufen nacheinander (Sperre je 30-Minuten-Zelle in Netlify Blobs), und vor dem Eintragen wird frisch nachgerechnet. Löscht das Team einen gebuchten Termin im Kalender, kann der Kunde über seinen Link neu buchen. Verschiebt es ihn, zeigt die Seite die neue Zeit.

## Einrichtung (einmalig, etwa 15 Minuten)

Empfohlen: **Dienstkonto mit domainweiter Delegation**. Dann liest und schreibt die Website im Namen von info@ und es muss kein Kalender einzeln geteilt werden.

1. [Google Cloud Console](https://console.cloud.google.com): Projekt anlegen (z. B. "skill-website"), unter "APIs und Dienste" die **Google Calendar API** aktivieren.
2. "IAM und Verwaltung" → Dienstkonten → Dienstkonto anlegen (Name z. B. "website-kalender"). Beim Dienstkonto unter "Schlüssel" einen JSON-Schlüssel erstellen und herunterladen. Die **Client-ID** (lange Zahl) notieren.
3. [Google Admin-Konsole](https://admin.google.com) mit dem Admin-Konto: Sicherheit → Zugriffs- und Datenverwaltung → API-Steuerung → **Domainweite Delegation verwalten** → Neu hinzufügen:
   - Client-ID aus Schritt 2
   - OAuth-Bereiche: `https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/calendar.freebusy`
4. Boris: in deinem Kalender boris.k@ unter "Für bestimmte Personen freigeben" info@skill-studios.com mindestens "Nur Verfügbarkeit (frei/belegt)" geben, falls info@ ihn noch nicht sieht. Ist er nicht lesbar, bietet die Website Boris gar nicht an.
5. Netlify → Site configuration → Environment variables:

| Variable | Inhalt |
|---|---|
| `GOOGLE_SA_EMAIL` | `client_email` aus der JSON-Datei |
| `GOOGLE_SA_KEY` | `private_key` aus der JSON-Datei (mit `\n`, so wie er dort steht) |
| `GOOGLE_SA_SUBJECT` | `info@skill-studios.com` |
| `ONBOARDING_SECRET` | lange Zufallszeichenkette (mind. 32 Zeichen). Verschlüsselt die Links. Ändern macht alle verschickten Links ungültig. |

Danach einmal neu veröffentlichen (Deploys → Trigger deploy).

Ohne Delegation geht es auch: `GOOGLE_SA_SUBJECT` leer lassen und jeden Kalender aus `CALENDARS` in Google Kalender mit der Adresse des Dienstkontos teilen (Onboarding und Probetraining: "Änderungen an Terminen vornehmen", alle anderen: "Alle Termindetails sehen", info@ und boris.k@ ebenso). Achtung: Die Workspace-Einstellung für externe Freigaben kann das Schreiben verbieten. Deshalb ist die Delegation einfacher.

Solange eine Variable fehlt, zeigen Dankeseite und /onboarding den Kalender mit Wunschterminen (siehe oben), die Willkommensmail verlinkt /onboarding und /probetraining leitet zur Google-Terminseite.

## Erster Test nach dem Einrichten

1. /probetraining mit deiner eigenen E-Mail ausfüllen, eine Zeit wählen: Termin im Kalender Probetraining, Mail an dich und an info@.
2. Den Termin im Kalender löschen, Seite neu laden: Die Zeit ist wieder frei.
3. Einen Kurs testweise in "Classes" eintragen: Die Zeit verschwindet beim nächsten Laden (spätestens nach einer Minute auf der offenen Seite).
4. Erst danach die Google-Terminseite für Probetrainings deaktivieren.

## Test

Kalender-Export als JSON `{service, classes, absences, appointments, personal}` (Format Google events.list, enthält Kundennamen, **nicht einchecken**):

    node scripts/test-onboarding-slots.mjs export.json --now 2026-11-18T23:00:00+01:00

Zeigt alle buchbaren Starts je Tag für Onboarding (90 Min) und Probetraining (30 Min) und prüft sie mit eigener, einfacher Logik gegen alle Termine (Schicht, Kurs, Abwesenheit, Termine, eigener Kalender). Exit-Code 1 bei einer Kollision. Stand 18.11.2026 mit echten Daten (19.11. bis 10.12.): Onboarding 57 Starts, Probetraining 155 Starts, 0 Kollisionen.
