/* Jeden Morgen um 8 Uhr (7 Uhr UTC, im Sommer 9 Uhr): Tagesbericht Verkauf an info@ (Inhalt: lib/sales-report.ts).
   Liest nur die Checkout-Datensätze, die es ohnehin gibt (checkout-leads, 30 Tage), sammelt nichts Neues und braucht keine Cookies.
   Sichert je Tag eine Zusammenfassung ohne Personendaten (Blob-Store "reports"), damit die Zahlen die 30-Tage-Löschung überstehen.
   Ohne Datensätze: keine Mail. Testkäufe mit eigener Adresse: REPORT_IGNORE_EMAILS (kommagetrennt) in Netlify. */
import type { Config } from "@netlify/functions";
import { listCheckoutLeadsChecked, saveDailyReport, listSt2Campaigns, getSt2Doc, getSt2Sales, saveSt2Sales } from "./lib/store";
import { salesFor, archiveId, CAMPAIGN, type Doc, type SalesArchive } from "./lib/skilltool2";
import { sendSalesReport, mailConfigured } from "./lib/notify";
import { buildSalesReport } from "./lib/sales-report";

export default async () => {
  const { leads, complete } = await listCheckoutLeadsChecked(); // zehn gleichzeitig, damit es in der Laufzeitgrenze bleibt
  const r = buildSalesReport(leads, new Date(), { ignoreEmails: (process.env.REPORT_IGNORE_EMAILS || "").split(",") });
  await saveDailyReport(r.day, r.summary).catch(e => console.log("sales-report speichern", String(e)));
  const sent = r.hasData && mailConfigured() ? await sendSalesReport(r.subject, r.html, r.text).catch(e => { console.log("sales-report mail", String(e)); return false; }) : false;
  /* SKILLTOOL2: Archiv je Kampagne fortschreiben (nach der Mail, damit der Bericht nie wartet), nur mit vollständig gelesenen Datensätzen */
  if (complete) for (const c of (await listSt2Campaigns().catch(() => [] as string[])).filter(x => CAMPAIGN.test(x))) {
    try {
      const doc = await getSt2Doc<Doc>(c);
      if (!doc) continue;
      const aid = archiveId(doc, c), archive = await getSt2Sales<SalesArchive>(aid);
      await saveSt2Sales(aid, salesFor(doc, c, leads, { archive, ignoreEmails: (process.env.REPORT_IGNORE_EMAILS || "").split(",") }).archive);
    } catch (e) { console.log(`sales-report Archiv ${c}`, String(e)); }
  }
  console.log(`sales-report ${r.day}: ${leads.length} Datensätze, ${r.tests} Tests, Mail ${sent ? "gesendet" : r.hasData ? "nicht gesendet" : "entfällt (keine Daten)"}`);
  return new Response(JSON.stringify({ day: r.day, leads: leads.length, sent }), { headers: { "Content-Type": "application/json" } });
};
export const config: Config = { schedule: "0 7 * * *" };
