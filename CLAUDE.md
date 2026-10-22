# SKILL CGN — Website

## Optische Referenz: manus-src (Vorrang)
Die optische Referenz ist ab jetzt der Ordner manus-src, das ist die frühere Website des Kunden, deren Design er zurück will. Bei Optik hat manus-src Vorrang vor dem Brand Book, also Farben, Flächen, Schatten, Effekte, Abstände, Schnitte und Animationen exakt wie dort. Das Brand Book gilt nur noch für Logo, Schriften und Texte. Was vom Brand Book bleibt:
- Logo nur aus /public/img (logo-white.svg, logo-black.svg, favicon.svg). Nie nachbauen.
- Schriften: Bebas Neue (Headlines, Versalien), Space Grotesk (Text, Buttons), IBM Plex Mono (Preise, Zeiten, Labels).
- Deutsch für Website-Text, Englisch nur für Claims (Show up. Earn it. Put in the work.).

Projekt: Marketing-Website für SKILL CGN, HYROX Official Gym, Köln. Vite + React + TypeScript + Tailwind. Deploy auf Netlify (dist/).

## 21st.dev Bausteine
Komponenten von 21st.dev werden als Prompt eingefügt. Danach IMMER an die Tokens anpassen: Farben ersetzen, rounded-* entfernen, shadow-* entfernen, Schriften auf font-display / font-sans / font-mono setzen.

## Fachliches
- Verträge entstehen über die Magicline Connect API, siehe src/lib/magicline.ts. Kein Server nötig. STUDIO_ID 1210006110.
- Angebote: start39 (Term-ID kommt live aus rate-bundle), Classic, Performance, Elite. Starter und Kraftwerk werden NICHT angezeigt.
- Preise NIE hart codieren, immer aus rate-bundle laden (Term = Laufzeit, price, flatFees = Aktivierungsgebühr).
- Probetraining: Formular -> createLead -> Redirect auf GOOGLE_BOOKING.
- Meta Pixel nur nach Consent (src/lib/pixel.ts). Events: PageView, ViewContent (start39, probetraining), InitiateCheckout, Purchase mit value.
- Kündigungsbutton /kuendigung mit Netlify Forms (form name="kuendigung", data-netlify).
- Rechtstexte 1:1 aus reference-site/impressum.html, datenschutz.html, agb.html übernehmen.

## Referenz
/reference-site enthält die aktuell live geschaltete statische Version aller Seiten. Inhalte und Texte von dort übernehmen, Design mit 21st.dev-Bausteinen aufwerten.

## Befehle
npm install · npm run dev · npm run build · npm run deploy (braucht `netlify login` einmalig und `netlify link` auf das Projekt stellular-lokum-05d42f)
