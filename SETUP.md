# Einrichtung in 20 Minuten

1. Node.js installieren: https://nodejs.org (LTS). Terminal öffnen, prüfen: `node -v`
2. Claude Code installieren: `npm install -g @anthropic-ai/claude-code`
3. Diesen Ordner entpacken, z. B. nach ~/skill-cgn. Terminal: `cd ~/skill-cgn` dann `npm install`
4. Netlify CLI: `npm install -g netlify-cli` dann `netlify login` dann `netlify link` (Projekt stellular-lokum-05d42f wählen)
5. Claude Code starten: `claude`
6. Prompts aus PROMPTS.md der Reihe nach einfügen. Nach jedem Schritt `npm run dev` und im Browser prüfen.
7. Live schalten: `npm run deploy`
