/*
 * Lokaler Test des Black-Month-Webhooks ohne Stripe, Magicline oder Resend: baut ein checkout.session.completed-Ereignis wie Stripe es sendet,
 * signiert es mit STRIPE_WEBHOOK_SECRET und schickt es an den lokalen Dev-Server. Der Server muss mit MAGICLINE_DRY_RUN=1 und MAIL_DRY_RUN=1 laufen
 * (Launch-Konfiguration "dist-test"), sonst entstehen echte Interessenten und Mails.
 *
 *   STRIPE_WEBHOOK_SECRET=whsec_test_local_only node scripts/test-blackmonth-webhook.mjs [--url http://localhost:8889/api/stripe/webhook] [--unpaid] [--link] [--dup] [--bad-sig]
 *     --link     Erkennung über payment_link statt metadata.campaign
 *     --unpaid   payment_status unpaid, muss ignoriert werden
 *     --dup      gleiche E-Mail wie der vorige Lauf (Dubletten-Prüfung)
 *     --bad-sig  falsche Signatur, muss 400 geben
 */
import { createHmac } from "node:crypto";
const args = process.argv.slice(2); const flag = f => args.includes(f); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const URL_ = opt("--url", "http://localhost:8889/api/stripe/webhook");
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || ""; if (!SECRET) { console.error("STRIPE_WEBHOOK_SECRET fehlt"); process.exit(1); }
const n = Date.now().toString(36);
const email = flag("--dup") ? "test-blackmonth-dup@example.com" : `test-blackmonth-${n}@example.com`;
const session = {
  id: `cs_test_${n}${"x".repeat(40)}`.slice(0, 66), object: "checkout.session", mode: "payment", status: "complete",
  payment_status: flag("--unpaid") ? "unpaid" : "paid", amount_total: 14900, currency: "eur", customer: `cus_test_${n}`,
  client_reference_id: "meta__paid__blackmonth_2026__c1", payment_link: flag("--link") ? "plink_1UX2n6HMQZbugHGZViuXdvsC" : "plink_other",
  metadata: flag("--link") ? {} : { campaign: "blackmonth_2026" },
  customer_details: { email, name: "Testa Blackmonth", phone: flag("--dup") ? "+49 151 00000000" : `+49 151 ${String(Date.now()).slice(-8)}` },
};
const event = { id: `evt_test_${n}`, object: "event", type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), livemode: false, data: { object: session } };
const payload = JSON.stringify(event); const ts = Math.floor(Date.now() / 1000);
const sig = createHmac("sha256", flag("--bad-sig") ? "wrong" : SECRET).update(`${ts}.${payload}`).digest("hex");
const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": `t=${ts},v1=${sig}` }, body: payload });
console.log(r.status, await r.text());
