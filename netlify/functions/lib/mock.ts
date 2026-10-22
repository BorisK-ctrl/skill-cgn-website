/* Testdaten-Kursplan, solange kein Magicline Open API Key hinterlegt ist. Wochenvorlage mit den fünf SKILL-Formaten. */
import { addDays, berlinToDate } from "./util";
import type { Slot } from "./types";

const WEEK: Record<number, [string, string, number][]> = { // 0 = Sonntag; [Uhrzeit, Format, Dauer Min]
  1: [["07:00", "SKILL I", 60], ["12:15", "HYROX", 60], ["17:00", "SKILL II", 60], ["18:00", "HYROX", 60], ["19:00", "RAW", 60]],
  2: [["07:00", "SKILL I", 60], ["12:15", "HYROX", 60], ["17:00", "ATHX", 60], ["18:00", "SKILL II", 60], ["19:00", "RAW", 60]],
  3: [["07:00", "SKILL I", 60], ["12:15", "HYROX", 60], ["17:00", "SKILL II", 60], ["18:00", "HYROX", 60], ["19:00", "RAW", 60]],
  4: [["07:00", "SKILL I", 60], ["12:15", "HYROX", 60], ["17:00", "ATHX", 60], ["18:00", "SKILL II", 60], ["19:00", "RAW", 60]],
  5: [["07:00", "SKILL I", 60], ["12:15", "HYROX", 60], ["17:00", "ATHX", 60], ["18:00", "SKILL II", 60]],
  6: [["10:00", "HYROX", 60], ["11:00", "SKILL I", 60], ["12:00", "RAW", 60]],
  0: [["10:00", "SKILL II", 60], ["11:00", "HYROX", 60]],
};
export function mockSlots(fromDate: string, days: number): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i); const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const [time, name, dur] of WEEK[dow] || []) {
      const start = berlinToDate(date, time); const end = new Date(start.getTime() + dur * 60000);
      const booked = (Number(date.replace(/-/g, "")) + time.charCodeAt(0) * 7 + name.length * 3) % 9; // stabile Pseudo-Belegung
      out.push({ id: `mock-${date}-${time.replace(":", "")}-${name.replace(/\s+/g, "").toLowerCase()}`, name, start: start.toISOString(), end: end.toISOString(), trainer: "Coach", max: 12, booked, free: 12 - booked, bookable: end.getTime() > Date.now(), source: "mock" });
    }
  }
  return out;
}
