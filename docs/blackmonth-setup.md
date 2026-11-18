# Black Month 2026: Einrichtung

Stand 2026-11-01. Seite `/blackmonth`, Dankeseite `/blackmonth/danke`, Webhook `netlify/functions/stripe-webhook.mts`, Nachfass `netlify/functions/blackmonth-followup.mts`.

## Ablauf

1. Kunde klickt auf `/blackmonth` den Knopf, landet auf dem Stripe Payment Link `https://buy.stripe.com/dRm28r7k7gf57zO6Hd5EY08`. UTM-Parameter der Seite gehen als `client_reference_id` (z. B. `meta__paid__blackmonth_2026__c1`) und als `utm_*` mit.
2. Stripe sendet `checkout.session.completed` an den Webhook. Erkennung: `metadata.campaign = blackmonth_2026` oder `payment_link = plink_1UX2n6HMQZbugHGZViuXdvsC`, nur `payment_status = paid`.
3. Webhook: Interessent in Magicline (Notiz `Black Month 149 € bezahlt, Stripe <Session>, <Datum>`), Dubletten-Prüfung über E-Mail und Telefon gegen frühere Black-Month-Käufe, Mail 1 an den Käufer, Info an Boris, Purchase an Meta (Conversions API, event_id = Session).
4. Stripe leitet den Kunden auf `/blackmonth/danke?session_id={CHECKOUT_SESSION_ID}`. Dort feuern Google Ads Conversion (Wert 149, transaction_id = Session) und Meta Purchase (nur mit Cookie-Zustimmung, event_id = Session, dedupliziert mit Schritt 3).
5. Täglich 09:00: Mail 2 an Käufer ohne Termin nach drei Tagen, Mail 3 am Tag vor dem Termin (Termine aus dem Google Kalender per iCal-Adresse).

## Startseite, Banner, Ablauf (Stand 2026-11-03)

- `src/lib/blackmonth.ts`: Daten der Aktion, `useBlackMonthActive()` (bis einschließlich 30.11.2026, Berliner Datum, erster Render immer aktiv), Hero-Varianten je `utm_content`.
- Banner auf allen Seiten mit Navbar (`src/components/BlackMonthBanner.tsx`, eingehängt im Layout), Menüpunkt und Footer-Eintrag „Black Month“, auf der Startseite Hero-Knopf „Black Month ansehen“ und Karte vor den Preisen. Der START-39-Banner der Startseite pausiert so lange.
- Ab 1.12. verschwindet alles von allein, `/blackmonth` leitet im Browser auf die Startseite (Prerender bleibt, Sitemap-Eintrag dann entfernen).
- OG-Bild `/img/og-blackmonth.jpg` (Rack-Motiv aus `hero-racks-freihanteln.webp`, 1200×630), nur für `/blackmonth` (`image` in `src/routes.ts`).
- Überschrift je Anzeige: `?utm_content=bm04_sled_25eur` → „Unter 25 € im Monat.“, `bm05_strength_6monate` → „6 Monate Gym. Einmal zahlen.“, sonst Standard (bm01_rack). Nur aus der URL, clientseitig.
- Zweiter Weg ohne Zahlung: „Erst anschauen, 10 Minuten“ → WhatsApp 0176 10877603 mit vorausgefülltem Text, darunter Vertrauenszeile (Google 4,9, 14 Tage Widerruf, Herzogstraße 16).

## In Stripe einstellen (Dashboard)

- Payment Link `plink_1UX2n6HMQZbugHGZViuXdvsC` → Bearbeiten → „Nach der Zahlung“: Weiterleitung auf `https://skill-studios.com/blackmonth/danke?session_id={CHECKOUT_SESSION_ID}`.
- Payment Link → Metadaten: `campaign` = `blackmonth_2026` (Erkennung klappt auch ohne, über die Link-ID).
- Payment Link → Telefonnummer abfragen einschalten (für Magicline und Dubletten-Prüfung).
- Entwickler → Webhooks → Endpunkt `https://skill-studios.com/api/stripe/webhook`, Ereignis `checkout.session.completed` (ist für den Shop schon eingerichtet, gleicher Endpunkt). Den Signatur-Schlüssel des Endpunkts als `STRIPE_WEBHOOK_SECRET` in Netlify eintragen, falls noch nicht geschehen.
- Alten Webhook des Manus-Tools deaktivieren (nicht löschen).

## Umgebungsvariablen in Netlify (Site configuration → Environment variables)

| Variable | Pflicht | Zweck |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | ja | Signaturprüfung des Webhooks (`whsec_…` vom Endpunkt) |
| `RESEND_API_KEY` | ja | Mailversand (gesetzt) |
| `BOOKING_URL` | nein | Link zur Terminbuchung in Mail 1 und 2. Leer: Satz „Schreib Boris per WhatsApp an 0176 10877603 mit deinem Wunschtag.“ |
| `BLACKMONTH_CALENDAR_ICS` | für Mail 2 und 3 | Geheime iCal-Adresse des Google Kalenders (Kalender → Einstellungen → „Privatadresse im iCal-Format“). Ohne sie gilt jeder Käufer als ohne Termin, Mail 3 geht nie raus. |
| `BLACKMONTH_NOTIFY_EMAIL` | nein | Empfänger der Kauf-Info, Standard `Boris.K@skill-studios.com`, zusätzlich immer info@ |
| `META_CAPI_TOKEN` | nein | Purchase serverseitig an Meta, Pixel 577923356905873 |

Für die Website (Build) zusätzlich die `VITE_*`-Variablen aus `.env`, sobald Netlify selbst baut.

## Mails

Alle drei Kundenmails von `SKILL CGN <info@skill-studios.com>`, Antwort an info@, Textfassung plus einfache HTML-Fassung, Signatur Boris Kurowski.

| | Betreff | Wann |
|---|---|---|
| Mail 1 | Du bist dabei, dein Black Month bei SKILL CGN | sofort nach Zahlung |
| Mail 2 | Dein Starttermin fehlt noch, Black Month bei SKILL CGN | 3 Tage nach Kauf ohne Termin, bis 15.12. |
| Mail 3 | Morgen geht es los, dein Start bei SKILL CGN | am Tag vor dem Termin |
| Boris | Black Month gekauft: Name, 149,00 € | sofort, mit Name, Telefon, E-Mail, Betrag, Session ID, Magicline-Status |

Solange die Domain bei Resend nicht verifiziert ist (DNS, siehe `docs/resend-dns-strato.md`), kommen Kundenmails nicht an, die Boris-Mail nur über den Testabsender an info@.

## Lokaler Test ohne echtes Geld

Launch-Konfiguration `dist-test` (Port 8889, `MAGICLINE_DRY_RUN=1`, `MAIL_DRY_RUN=1`, Test-Signaturschlüssel), dann:

```bash
STRIPE_WEBHOOK_SECRET=whsec_test_local_only node scripts/test-blackmonth-webhook.mjs
```

Varianten `--link`, `--dup`, `--unpaid`, `--bad-sig`. Getestet 2026-11-01: Erkennung über Metadaten und Link, Dublette erkannt, unbezahlt ignoriert, falsche Signatur 400.

Stripe-Testmodus: im Dashboard auf Testdaten umschalten, einen Test-Payment-Link mit Metadaten `campaign=blackmonth_2026` anlegen, mit Testkarte 4242 4242 4242 4242 zahlen. Der Webhook braucht dafür den Test-Signaturschlüssel, also nur gegen eine Deploy-Preview oder lokal mit `stripe listen`.

## Ablage

Netlify Blobs Store `blackmonth`: `s/<session>` je Kauf (Name, E-Mail, Telefon, Betrag, Magicline-Nummer, Mails, Termin), `idx/email/<mail>` und `idx/phone/<nummer>` für die Dubletten-Prüfung.

## angebot.skill-studios.com

Alte Manus-Seite. Netlify-Redirect `https://angebot.skill-studios.com/*` → `/blackmonth` steht in der netlify.toml. Der Domain-Alias muss im Netlify-Projekt angelegt sein (Domain management → Add domain alias oder `netlify api updateSite`), danach bei STRATO den CNAME von manus.space auf `stellular-lokum-05d42f.netlify.app` stellen.

## Git-Identität

Netlify baut bei privaten Repos nur Commits von Team-Mitgliedern. Die Git-Identität in diesem Repo ist deshalb `info@skill-studios.com` (repo-lokal gesetzt, `git config user.email`).
