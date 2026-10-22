/* GET /api/schedule?from=YYYY-MM-DD&days=7 → Kursplan (Magicline live oder Testdaten) inkl. lokaler Buchungen. */
import type { Config } from "@netlify/functions";
import { json, berlinDate } from "./lib/util";
import { listSlots, magiclineConfigured } from "./lib/magicline";
import { mockSlots } from "./lib/mock";
import { activeBookingCounts } from "./lib/store";
import type { Slot } from "./lib/types";

export default async (req: Request) => {
  const url = new URL(req.url);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "") ? url.searchParams.get("from")! : berlinDate(new Date());
  const days = Math.min(7, Math.max(1, Number(url.searchParams.get("days") || 7)));
  const live = magiclineConfigured();
  let slots: Slot[];
  try { slots = live ? await listSlots(from, days) : mockSlots(from, days); }
  catch (e: any) { return json({ error: "Kursplan gerade nicht erreichbar", detail: String(e?.message || e) }, 502); }
  /* Lokale Buchungen (Testmodus und Buchungen, die nicht in Magicline landen konnten) mitzählen */
  const local = await activeBookingCounts(slots.map(s => s.id));
  const now = Date.now();
  for (const s of slots) {
    const extra = local[s.id] || 0;
    if (s.source === "mock") { s.booked += extra; }
    s.free = Math.max(0, s.max - s.booked - (s.source === "magicline" ? extra : 0));
    s.bookable = s.bookable && new Date(s.start).getTime() > now + 15 * 60000;
  }
  const byDay: Record<string, Slot[]> = {};
  for (const s of slots.sort((a, b) => a.start.localeCompare(b.start))) (byDay[berlinDate(new Date(s.start))] ||= []).push(s);
  return json({ mode: live ? "live" : "mock", from, days, byDay }, 200, { "Cache-Control": "public, max-age=60" });
};
export const config: Config = { path: "/api/schedule" };
