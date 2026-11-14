# Onboarding-Buchung (/onboarding)

Stand 2026-11-14. Nach jedem Abschluss einer Mitgliedschaft (START 39, BACK 39, Vor-Ort, Black Month) enthält die Willkommensmail einen persönlichen Link `/onboarding?t=…`. Der Kunde wählt dort einen 90-Minuten-Termin (Scan, Einweisung, Trainingsplan), der Termin landet im Kalender **Onboarding**, Kunde und Team bekommen eine Mail.

## Regel für freie Zeiten

Onboardings machen Peter, Nic, Noah und Boris (`STAFF` in `netlify/functions/lib/onboarding.ts`). Ein Start ist buchbar, wenn mindestens einer von ihnen

1. im Kalender **SERVICE** eine Schicht hat, die die vollen 90 Minuten abdeckt (Titel oder Gast mit seinem Namen),
2. in der Zeit keinen eigenen Kurs in **SKILL Classes** gibt (Zeile `Coach:` oder Name im Titel),
3. nicht abwesend ist (ganztägiger Eintrag in SERVICE wie "Nic Uni", Kalender Urlaub oder Urlaub Coaches),
4. keinen anderen Termin hat (Onboarding, Probetraining, Personal Training, Erstgespräch, Six Week onboarding).

Termine ohne erkennbaren Mitarbeiter (z. B. "Personal Training Skill") belegen vorsichtshalber einen der freien. Raster 30 Minuten, frühestens 12 Stunden im Voraus, drei Wochen sichtbar. Wer keine Schicht in SERVICE hat, ist nicht buchbar.

## Einrichtung (einmalig)

1. Google Cloud Console, Projekt anlegen, **Google Calendar API** aktivieren.
2. Dienstkonto anlegen, Schlüssel als JSON herunterladen.
3. In Google Kalender die Kalender mit der Adresse des Dienstkontos teilen:
   - Onboarding: "Änderungen an Terminen vornehmen"
   - SERVICE, SKILL Classes, Urlaub, Urlaub Coaches, Probetraining, Personal Training, Erstgespräch, Six Week onboarding: "Alle Termindetails sehen"
4. Netlify → Site configuration → Environment variables:

| Variable | Inhalt |
|---|---|
| `GOOGLE_SA_EMAIL` | `client_email` aus der JSON-Datei |
| `GOOGLE_SA_KEY` | `private_key` aus der JSON-Datei (mit `\n`, so wie er dort steht) |
| `ONBOARDING_SECRET` | lange Zufallszeichenkette, signiert die Links. Ändern macht alle verschickten Links ungültig. |

Solange eine der drei fehlt, enthalten die Mails wie bisher den WhatsApp-Weg.

## Test

Kalender-Export als JSON `{service, classes, absences, appointments}` (Format Google events.list, enthält Kundennamen, nicht einchecken):

    node scripts/test-onboarding-slots.mjs export.json --from 2026-11-16 --days 21

Zeigt alle buchbaren Starts je Tag mit dem freien Mitarbeiter und prüft feste Fälle (Kurs, Abwesenheit, PT, Wochenende).
