/* GET /api/ticket?email= → Guthaben eines Ticketkäufers (nur Zahlen, keine weiteren Daten). */
import type { Config } from "@netlify/functions";
import { json, normEmail, validEmail } from "./lib/util";
import { getTicket } from "./lib/store";

export default async (req: Request) => {
  const email = normEmail(new URL(req.url).searchParams.get("email") || "");
  if (!validEmail(email)) return json({ error: "E-Mail ungültig" }, 400);
  const t = await getTicket(email);
  if (!t) return json({ found: false });
  const valid = !t.validUntil || t.validUntil >= new Date().toISOString().slice(0, 10);
  return json({ found: true, credits: valid ? t.credits : 0, ptCredits: t.ptCredits, validUntil: t.validUntil });
};
export const config: Config = { path: "/api/ticket" };
