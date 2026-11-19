/* Jeden Morgen um 8 Uhr (7 Uhr UTC, im Sommer 9 Uhr): Tagesbericht Verkauf an info@ (Inhalt: lib/sales-report.ts).
   Liest nur die Checkout-Datensätze, die es ohnehin gibt (checkout-leads, 30 Tage), sammelt nichts Neues und braucht keine Cookies.
   Sichert je Tag eine Zusammenfassung ohne Personendaten (Blob-Store "reports"), damit die Zahlen die 30-Tage-Löschung überstehen.
   Ohne Datensätze: keine Mail. Testkäufe mit eigener Adresse: REPORT_IGNORE_EMAILS (kommagetrennt) in Netlify. */
import type { Config } from "@netlify/functions";
import { listCheckoutLeadTokens, getCheckoutLead, saveDailyReport, type CheckoutLead } from "./lib/store";
import { sendSalesReport, mailConfigured } from "./lib/notify";
import { buildSalesReport } from "./lib/sales-report";

export default async () => {
  const tokens = await listCheckoutLeadTokens();
  const leads: CheckoutLead[] = [];
  for (let i = 0; i < tokens.length; i += 10) { // zehn gleichzeitig, damit es in der Laufzeitgrenze bleibt
    for (const l of await Promise.all(tokens.slice(i, i + 10).map(t => getCheckoutLead(t).catch(() => null)))) if (l) leads.push(l);
  }
  const r = buildSalesReport(leads, new Date(), { ignoreEmails: (process.env.REPORT_IGNORE_EMAILS || "").split(",") });
  await saveDailyReport(r.day, r.summary).catch(e => console.log("sales-report speichern", String(e)));
  const sent = r.hasData && mailConfigured() ? await sendSalesReport(r.subject, r.html, r.text).catch(e => { console.log("sales-report mail", String(e)); return false; }) : false;
  console.log(`sales-report ${r.day}: ${leads.length} Datensätze, ${r.tests} Tests, Mail ${sent ? "gesendet" : r.hasData ? "nicht gesendet" : "entfällt (keine Daten)"}`);
  return new Response(JSON.stringify({ day: r.day, leads: leads.length, sent }), { headers: { "Content-Type": "application/json" } });
};
export const config: Config = { schedule: "0 7 * * *" };
