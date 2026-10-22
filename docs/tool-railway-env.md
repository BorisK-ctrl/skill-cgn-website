# SKILL CGN Tool: Umgebungsvariablen für Railway

Stand 2026-10-23, aus dem Quellcode-Export vom 2026-10-18 ermittelt. Werte trägt Boris in Railway ein (Service skill-tool, Variables). Keine Werte in diese Datei schreiben.

## Pflicht (ohne läuft nichts)

- `DATABASE_URL` — verwendet in _core/env.ts, db.ts
- `JWT_SECRET` — verwendet in _core/env.ts, staffSession.ts
- `NODE_ENV` — verwendet in _core/env.ts, _core/index.ts, _core/vite.ts, index.ts
- `PORT` — verwendet in _core/index.ts, index.ts

## Magicline (Mitglieder, Verträge, Kurse)

- `MAGICLINE_TENANT` — verwendet in _core/env.ts, backToSkillEligibility.ts, routers/hyroxTicket.ts, routers/magicline.ts
- `MAGICLINE_USERNAME` — verwendet in _core/env.ts, backToSkillEligibility.ts
- `MAGICLINE_PASSWORD` — verwendet in _core/env.ts, backToSkillEligibility.ts

## E-Mail (Resend)

- `RESEND_API_KEY` — verwendet in _core/env.ts, routers.ts, routers/contractEmail.ts, routers/jobs.ts, routers/membership.ts, routers/monthlyUscReportHand
- `RESEND_FROM_EMAIL` — verwendet in routers/contractEmail.ts

## Stripe (Tickets, Webhook)

- `STRIPE_SECRET_KEY` — verwendet in _core/env.ts
- `STRIPE_WEBHOOK_SECRET` — verwendet in _core/env.ts
- `VITE_STRIPE_PUBLISHABLE_KEY` — verwendet in _core/env.ts

## Google Calendar (Dienstplan, Kurse, Reinigung)

- `GOOGLE_CALENDAR_CLIENT_ID` — verwendet in _core/env.ts, scripts/clearAndResyncShifts.ts
- `GOOGLE_CALENDAR_CLIENT_SECRET` — verwendet in _core/env.ts, scripts/clearAndResyncShifts.ts
- `GOOGLE_CALENDAR_REDIRECT_URI` — verwendet in _core/env.ts, scripts/clearAndResyncShifts.ts
- `GOOGLE_CALENDAR_ID` — verwendet in _core/env.ts
- `GOOGLE_CLASSES_CALENDAR_ID` — verwendet in _core/env.ts
- `GOOGLE_SERVICE_CALENDAR_ID` — verwendet in _core/env.ts, scripts/clearAndResyncShifts.ts
- `GOOGLE_CLEANING_CALENDAR_ID` — verwendet in _core/env.ts, scripts/clearAndResyncShifts.ts

## WhatsApp Business

- `WHATSAPP_ACCESS_TOKEN` — verwendet in routers/metaLeadsWebhook.ts, routers/whatsapp.ts
- `WHATSAPP_PHONE_NUMBER_ID` — verwendet in routers/whatsapp.ts
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — im Export nicht gefunden (vermutlich nur in der Manus-Laufzeit)

## Meta (CAPI, Leads)

- `META_CAPI_ACCESS_TOKEN` — verwendet in metaConversions.ts
- `META_CAPI_ENABLED` — verwendet in metaConversions.ts
- `META_CAPI_TEST_EVENT_CODE` — verwendet in metaConversions.ts
- `META_PAGE_ACCESS_TOKEN` — verwendet in routers/leads.ts, routers/metaAds.ts

## Urban Sports Club

- `USC_EMAIL` — verwendet in _core/env.ts
- `USC_PASSWORD` — verwendet in _core/env.ts
- `SHOPPING_API_TOKEN` — verwendet in _core/env.ts, _core/index.ts, routers/instagram.ts

## Sonstiges

- `NOTION_API_TOKEN` — verwendet in _core/env.ts
- `RECAPTCHA_SECRET_KEY` — verwendet in routers/magicline.ts, routers/membership.ts
- `VITE_RECAPTCHA_SITE_KEY` — verwendet in client:MagiclineCheckout.tsx
- `OWNER_OPEN_ID` — verwendet in _core/env.ts
- `OAUTH_SERVER_URL` — verwendet in _core/env.ts
- `BUILT_IN_FORGE_API_URL` — verwendet in _core/env.ts
- `BUILT_IN_FORGE_API_KEY` — verwendet in _core/env.ts
- `VITE_APP_ID` — verwendet in _core/env.ts, client:const.ts
- `VITE_ANALYTICS_WEBSITE_ID` — verwendet in _core/env.ts
- `VITE_ANALYTICS_ENDPOINT` — verwendet in _core/env.ts
- `APPLY` — im Export nicht gefunden (vermutlich nur in der Manus-Laufzeit)

## Weitere, im Code gefunden

- `VITE_FRONTEND_FORGE_API_KEY` — client:Map.tsx
- `VITE_FRONTEND_FORGE_API_URL` — client:Map.tsx
- `VITE_OAUTH_PORTAL_URL` — client:const.ts

## Hinweise

- Manus-spezifische Variablen (OAUTH_SERVER_URL, OWNER_OPEN_ID, BUILT_IN_FORGE_*, VITE_APP_ID, VITE_ANALYTICS_*) gehören zur Manus-Plattform und entfallen auf Railway; die Railway-Version in manus-src hat die Anmeldung auf JWT (staffAuth) umgestellt.
- Webhook-Ziele (Stripe, WhatsApp, Meta Leads) in den jeweiligen Dashboards auf die Railway-URL setzen: /api/stripe/webhook, /api/whatsapp/webhook, /api/meta/leads/webhook.
- Die Zugangsdaten aus `.project-config.json` im Export sind kompromittiert und müssen vor dem Eintragen neu erzeugt werden (TiDB-Passwort, Forge-Key).