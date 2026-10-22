/* Protokoll der Vertragsanlage: je Aufruf Request-Zusammenfassung und Magicline-Antwort (ohne IBAN).
   Ablage in Netlify Blobs "checkout-log", zusätzlich im Function-Log (app.netlify.com → Logs → Functions). */
import type { Config } from "@netlify/functions";
import { json } from "./lib/util";
import { saveCheckoutLog } from "./lib/store";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage" }, 400); }
  const stage = String(b.stage || "").slice(0, 40); if (!stage) return json({ error: "stage fehlt" }, 400);
  const entry = { at: new Date().toISOString(), stage, campaign: String(b.campaign || "").slice(0, 40), token: String(b.token || "").slice(0, 48), request: b.request ?? null, response: b.response ?? null, error: b.error ? String(b.error).slice(0, 1000) : null };
  const s = JSON.stringify(entry); if (s.length > 20000) return json({ error: "zu groß" }, 413);
  if (/[A-Z]{2}\d{2}[A-Z0-9 ]{11,34}/.test(s.replace(/\s/g, "")) && /iban/i.test(s)) return json({ error: "IBAN gehört nicht ins Log" }, 400);
  console.log(`checkout-log ${stage} ${entry.campaign} ${entry.token}: ${s.slice(0, 1500)}`);
  await saveCheckoutLog(entry);
  return json({ ok: true });
};
export const config: Config = { path: "/api/checkout-log" };
