/*
 * Prüft die Onboarding-Logik (netlify/functions/lib/onboarding.ts) gegen einen Kalender-Export, ohne Google-Zugang.
 * Der Export ist JSON {service, classes, absences, appointments} mit Terminen im Format von Google events.list.
 * Er enthält Kundennamen und gehört nicht ins Repository.
 *
 *   node scripts/test-onboarding-slots.mjs <export.json> [--from 2026-11-16] [--days 21] [--now 2026-11-15T12:00:00Z]
 *
 * Ausgabe: buchbare Starts je Tag mit den freien Mitarbeitern, danach die festen Prüfungen (Exit-Code 1 bei Fehler).
 */
import { readFileSync } from "node:fs";
import { build } from "rolldown";

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--") && !/^\d/.test(a));
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error("Aufruf: node scripts/test-onboarding-slots.mjs <export.json> [--from YYYY-MM-DD] [--days N] [--now ISO]"); process.exit(2); }

const out = await build({ input: new URL("../netlify/functions/lib/onboarding.ts", import.meta.url).pathname, platform: "node", write: false, output: { format: "esm" } });
const lib = await import("data:text/javascript;base64," + Buffer.from(out.output[0].code).toString("base64"));

const data = JSON.parse(readFileSync(file, "utf8"));
const from = opt("from", "2026-11-16"), days = Number(opt("days", 21)), now = new Date(opt("now", "2026-11-15T12:00:00Z"));
const start = new Date(`${from}T00:00:00+01:00`), end = new Date(start.getTime() + days * 86400000);
const slots = lib.computeSlots(data, { from: start, to: end, now });

const tz = { timeZone: "Europe/Berlin" };
const day = iso => new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", ...tz });
const time = iso => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", ...tz });
const byDay = {};
for (const s of slots) (byDay[day(s.start)] ||= []).push(`${time(s.start)} (${s.staff.join("+")})`);
for (const [d, list] of Object.entries(byDay)) console.log(`${d}  ${list.join("  ")}`);
console.log(`\n${slots.length} buchbare Starts in ${Object.keys(byDay).length} Tagen`);

/* Feste Prüfungen gegen die Regel: im Termin weder eigener Kurs noch Abwesenheit, Schicht deckt alles ab */
const at = (d, t) => new Date(`${d}T${t}:00+01:00`).toISOString();
const has = (d, t, who) => slots.some(s => s.start === at(d, t) && (!who || s.staff.includes(who)));
const checks = [
  ["Mo 16.11. 07:00 Noah gibt Kurs", !has("2026-11-16", "07:00", "noah")],
  ["Mo 16.11. 09:00 Noah frei (Kurse 8:00-8:50 und 11:30)", has("2026-11-16", "09:00", "noah")],
  ["Mo 16.11. 10:30 Noah nicht (Kurs 11:30 im Termin)", !has("2026-11-16", "10:30", "noah")],
  ["Mo 16.11. 12:30 Noah nicht (Kurs 12:30, PT ohne Coach 13-14)", !has("2026-11-16", "12:30")],
  ["Mo 16.11. 17:00 niemand (nur Silvana im Service)", !has("2026-11-16", "17:00")],
  ["Do 19.11. Peter nie während seiner Kurse 7/8/10:30/12", !slots.some(s => s.staff.includes("peter") && s.start.startsWith("2026-11-19") && ["07:00", "07:30", "10:00", "10:30", "11:00", "11:30", "12:00"].includes(time(s.start)))],
  ["Fr 20.11. Nic ganztägig Uni", !slots.some(s => s.staff.includes("nic") && day(s.start).includes("20.11."))],
  ["Fr 20.11. 09:00 Peter nicht (PT Tim 9:30)", !has("2026-11-20", "09:00", "peter")],
  ["Di 24.11. 17:00 Nic nicht (PT Jonas 18:00)", !has("2026-11-24", "17:00", "nic")],
  ["Do 26.11. 16:00 Nic frei (Kurse 16:30/17:30 gibt Antonia, nicht Nic)", has("2026-11-26", "16:00", "nic")],
  ["Do 26.11. 19:30 Nic nicht (eigener Kurs 20:30)", !has("2026-11-26", "19:30", "nic")],
  ["Boris ohne Schicht nie buchbar", !slots.some(s => s.staff.includes("boris"))],
  ["Wochenende keine Termine (nur Sanja im Service)", !slots.some(s => /^(Sa|So)/.test(day(s.start)))],
  ["Kein Start vor 'now' + 12 h", slots.every(s => Date.parse(s.start) >= now.getTime() + 12 * 3600000)],
];
let failed = 0;
console.log("");
for (const [name, ok] of checks) { console.log(`${ok ? "OK  " : "FEHL"} ${name}`); if (!ok) failed++; }
process.exit(failed ? 1 : 0);
