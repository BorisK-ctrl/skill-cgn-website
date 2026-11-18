/* Alle 5 Minuten: Leads, die vor mehr als 10 Minuten Schritt 1 abgeschickt haben und keinen Vertrag haben, bekommen einmal die Erinnerungsmail.
   Einträge älter als 30 Tage werden gelöscht. Ohne RESEND_API_KEY passiert nichts außer Aufräumen. */
import type { Config } from "@netlify/functions";
import { getCheckoutLead, saveCheckoutLead, listCheckoutLeadTokens, deleteCheckoutLead } from "./lib/store";
import { sendCheckoutReminder, mailConfigured } from "./lib/notify";
import { deliverWelcome, welcomeInputFromLead, WELCOME_FORCE_AFTER_MS } from "./lib/welcome";

const WAIT_MS = 10 * 60 * 1000, KEEP_MS = 30 * 24 * 60 * 60 * 1000;
export default async () => {
  const now = Date.now(); let sent = 0, removed = 0, welcomes = 0;
  for (const token of await listCheckoutLeadTokens()) {
    const l = await getCheckoutLead(token); if (!l) continue;
    const age = now - new Date(l.createdAt).getTime();
    if (age > KEEP_MS) { await deleteCheckoutLead(token); removed++; continue; }
    /* Willkommensmail nachreichen (Issue #2): sobald Vertrag und SEPA-Mandat in Magicline liegen, spätestens nach 10 Minuten */
    if (l.done && l.welcome && !l.welcome.sentAt && mailConfigured()) {
      const input = welcomeInputFromLead(l);
      if (input) {
        const r = await deliverWelcome(l, input, { budgetMs: 4000, force: now - Date.parse(l.welcome.pendingSince) >= WELCOME_FORCE_AFTER_MS }).catch(e => { console.log("welcome error", String(e)); return "pending"; });
        await saveCheckoutLead(l); if (r === "sent") welcomes++;
      }
      continue;
    }
    if (l.done || l.mailedAt || age < WAIT_MS || !mailConfigured()) continue;
    if (await sendCheckoutReminder(l)) { l.mailedAt = new Date().toISOString(); await saveCheckoutLead(l); sent++; }
  }
  console.log(`checkout-reminder: ${sent} Mails, ${welcomes} Willkommensmails, ${removed} gelöscht`);
  return new Response(JSON.stringify({ sent, welcomes, removed }), { headers: { "Content-Type": "application/json" } });
};
export const config: Config = { schedule: "*/5 * * * *" };
