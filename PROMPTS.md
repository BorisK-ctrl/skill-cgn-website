# Prompts für Claude Code, in dieser Reihenfolge

## 1 Basis
Lies CLAUDE.md und reference-site/brand.html. Führe `npm install` aus, starte `npm run dev` und bestätige, dass die Startseite ohne Fehler rendert. Ändere noch nichts.

## 2 Seiten portieren
Portiere alle Seiten aus /reference-site nach React: start39, memberships, classes, probetraining, checkout, danke, kuendigung, impressum, datenschutz, agb, brand. Texte 1:1 übernehmen. Checkout-Logik mit src/lib/magicline.ts umsetzen, inklusive Unterschriftsfeld, IBAN-Prüfung, Laufzeitwahl aus rate-bundle, Purchase-Event. Probetraining mit createLead und Redirect. Alle Platzhalter in App.tsx ersetzen.

## 3 Hero
Hole von 21st.dev einen Animated Hero (Suche: "animated hero" oder "hero with text reveal"). Baue ihn in src/pages/Home.tsx an Stelle des ersten Blocks ein. Headline SHOW UP. / EARN IT. (zweite Zeile gelb), Text und zwei Buttons wie vorhanden. Hintergrund /img/hero.jpg abgedunkelt, S-Icon 8% Deckkraft rechts angeschnitten. Passe Farben, Schriften und Radius an CLAUDE.md an.

## 4 Zahlen
Hole einen Number Ticker (Suche: "number ticker" oder "animated counter"). Ersetze den Stats-Block. Werte: 4,9 · 3.000+ · Official · 4. Mono, gelb.

## 5 Laufband
Hole eine Marquee-Komponente (Suche: "marquee" oder "infinite scroll text"). Text: SKILL · HYROX · RAW · ATHX · SHOW UP. · EARN IT. Bebas Neue, weiß, langsam, zwischen Zahlen und Kursplan.

## 6 Formate
Hole ein Bento Grid (Suche: "bento grid"). Vier Kacheln SKILL, HYROX, RAW, ATHX mit Text aus reference-site/index.html, Hover-Effekt, anthrazit, 1px Linien.

## 7 Bewertungen und Preise
Hole eine Testimonial-Komponente und Pricing Cards. Inhalte aus reference-site/index.html. Performance hervorgehoben (gelber Rahmen). Preise in Mono. Keine Sterne-Grafiken.

## 8 Vergleich, FAQ, Standort, CTA
Vergleich Mitglied vs Urban Sports als zwei Spalten. FAQ als Accordion (Suche: "accordion"). Standort und CTA aus der Referenz.

## 9 Mobil
Prüfe jede Seite bei 390px Breite. Sticky-Leiste unten mit WhatsApp und Start 39 muss überall sichtbar sein. Behebe Überläufe.

## 10 Live
`npm run build` und `npm run deploy`. Danach https://skill-studios.com prüfen: Fonts geladen, Pixel feuert nach Consent, Checkout lädt Angebote.
