/* GET /api/termin.ics?d=<signiert> → Kalenderdatei (Apple, Outlook) für einen gebuchten Termin. Die Daten (Art, Start, Ende) sind mit
   ONBOARDING_SECRET signiert (signData in lib/onboarding.ts), damit niemand beliebige Dateien unter unserer Domain erzeugt. */
import type { Config } from "@netlify/functions";
import { verifyData, KINDS, type Kind } from "./lib/onboarding";
import { icsFile } from "./lib/booking";

export default async (req: Request) => {
  const d = verifyData<{ k: Kind; s: string; e: string }>(new URL(req.url).searchParams.get("d") || "");
  if (!d || !(d.k in KINDS) || !Date.parse(d.s) || !Date.parse(d.e)) return new Response("Link ungültig", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(icsFile(d.k, new Date(d.s).toISOString(), new Date(d.e).toISOString()), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="skill-${d.k}.ics"`, "Cache-Control": "no-store" },
  });
};
export const config: Config = { path: "/api/termin.ics" };
