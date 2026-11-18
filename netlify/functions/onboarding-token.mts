/* POST /api/onboarding/token {token, contractId} → signierter Onboarding-Token für die Terminwahl auf der Dankeseite.
   Nur für einen Checkout-Lead, der mit Vertrag abgeschlossen ist (checkout-lead "done" bzw. Stripe-Webhook). Der Checkout-Token liegt nur im
   Browser des Käufers (sessionStorage), dadurch kann niemand fremde Termine buchen.
   Antworten: {available:false} solange Google-Zugang oder ONBOARDING_SECRET fehlen (Seite zeigt dann WhatsApp),
   202 {pending:true} solange der Abschluss noch nicht am Lead steht (Browser fragt kurz erneut), sonst {available:true, t}. */
import type { Config } from "@netlify/functions";
import { json } from "./lib/util";
import { getCheckoutLead } from "./lib/store";
import { signToken } from "./lib/onboarding";
import { gcalConfigured } from "./lib/gcal";

const TOKEN = /^[a-z0-9]{16,48}$/; // wie checkout-lead

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!gcalConfigured() || !(process.env.ONBOARDING_SECRET || "").trim()) return json({ available: false });
  const b = (await req.json().catch(() => ({}))) as { token?: string; contractId?: string };
  const token = String(b.token || "");
  if (!TOKEN.test(token)) return json({ error: "Ungültige Anfrage" }, 400);
  const l = await getCheckoutLead(token);
  if (!l) return json({ error: "Abschluss nicht gefunden" }, 404);
  if (!l.done || !l.contractId) return json({ pending: true }, 202);
  if (b.contractId && String(b.contractId) !== l.contractId) return json({ error: "Abschluss passt nicht" }, 403);
  const t = signToken({ n: `${l.firstName} ${l.lastName}`.trim(), e: l.email.trim().toLowerCase(), p: l.phone || undefined, o: l.campaign || undefined, r: "ml:" + l.contractId, k: "onboarding" });
  return json({ available: true, t });
};
export const config: Config = { path: "/api/onboarding/token" };
