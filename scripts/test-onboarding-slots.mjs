/*
 * Prüft die Terminlogik (netlify/functions/lib/onboarding.ts) gegen einen Kalender-Export, ohne Google-Zugang.
 * Export: JSON {service, classes, absences, appointments, personal?} mit Terminen im Format von Google events.list
 * (personal = {staffKey: {busy: [{start, end}]}} wie freeBusy). Er enthält Kundennamen und gehört NICHT ins Repository.
 *
 *   node scripts/test-onboarding-slots.mjs <export.json> [--kind onboarding|probetraining|beide] [--now 2026-11-18T23:00:00+01:00]
 *
 * Ausgabe: buchbare Starts je Tag (Coach in Klammern, ? = Termin ohne sicheren Coach gleichzeitig), danach eine unabhängige Prüfung mit
 * eigener, einfacher Logik (nicht computeSlots): Schicht deckt den Termin ab, keine Überschneidung mit einem Termin, Kurs oder einer
 * Abwesenheit, die den Coach nennt (Titel, Beschreibung, Gäste), keine Überschneidung mit seinem eigenen Kalender, Raster, Vorlauf, Horizont.
 * Exit-Code 1 bei einer Kollision.
 */
import { readFileSync } from "node:fs";
import { build } from "rolldown";

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--") && !/^\d/.test(a) && !/^(onboarding|probetraining|beide)$/.test(a));
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error("Aufruf: node scripts/test-onboarding-slots.mjs <export.json> [--kind onboarding|probetraining|beide] [--now ISO]"); process.exit(2); }

const out = await build({ input: new URL("../netlify/functions/lib/onboarding.ts", import.meta.url).pathname, platform: "node", write: false, output: { format: "esm" } });
const lib = await import("data:text/javascript;base64," + Buffer.from(out.output[0].code).toString("base64"));
const data = JSON.parse(readFileSync(file, "utf8"));
const now = new Date(opt("now", new Date().toISOString()));
const kinds = opt("kind", "beide") === "beide" ? Object.keys(lib.KINDS) : [opt("kind")];

const tz = { timeZone: "Europe/Berlin" };
const day = iso => new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", ...tz });
const time = iso => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", ...tz });
const span = e => ({ s: e.start?.dateTime ? Date.parse(e.start.dateTime) : Date.parse(`${e.start?.date}T00:00:00+01:00`), e: e.end?.dateTime ? Date.parse(e.end.dateTime) : Date.parse(`${e.end?.date}T00:00:00+01:00`) });
const word = (n, t) => new RegExp(`(^|[^\\p{L}])${n}([^\\p{L}]|$)`, "iu").test(t || "");
const names = lib.STAFF.map(s => s.name);
let failed = 0;

for (const kind of kinds) {
  const K = lib.KINDS[kind];
  const to = new Date(now.getTime() + lib.HORIZON_DAYS * 86400000);
  const slots = lib.computeSlots(data, { from: now, to, now, durationMin: K.durationMin, leadHours: K.leadHours });
  const byDay = {};
  for (const s of slots) (byDay[day(s.start)] ||= []).push(`${time(s.start)}${s.uncertain ? "?" : ""}(${s.staff[0]})`);
  console.log(`\n${K.label} (${K.durationMin} Min): ${slots.length} buchbare Starts an ${Object.keys(byDay).length} Tagen`);
  for (const [d, list] of Object.entries(byDay)) console.log(`${d}  ${list.join(" ")}`);

  const errors = [];
  for (const s of slots) {
    const a = Date.parse(s.start), b = Date.parse(s.end), st = lib.STAFF.find(x => x.key === s.staff[0]);
    if (b - a !== K.durationMin * 60000) errors.push(`Dauer ${s.start}`);
    if (a % 1800000) errors.push(`Raster ${s.start}`);
    if (a < now.getTime() + K.leadHours * 3600000 || a > now.getTime() + lib.HORIZON_DAYS * 86400000) errors.push(`Vorlauf/Horizont ${s.start}`);
    const own = e => !!e.start?.dateTime && new RegExp(`^${st.name}( service)?$`, "i").test((e.summary || "").trim());
    let cover = a; for (const x of data.service.filter(own).map(span).sort((p, q) => p.s - q.s)) if (x.s <= cover && x.e > cover) cover = x.e;
    if (cover < b) errors.push(`${day(s.start)} ${time(s.start)} ${st.name}: keine Schicht`);
    for (const [cal, list] of Object.entries({ service: data.service, classes: data.classes, absences: data.absences, appointments: data.appointments })) for (const ev of list) {
      const x = span(ev); if (!(x.s < b && x.e > a) || ev.status === "cancelled") continue;
      if (cal === "service" && (own(ev) || (!!ev.start?.dateTime && !names.some(n => word(n, ev.summary))))) continue;
      const named = word(st.name, ev.summary) || word(st.name, ev.description) || (ev.attendees || []).some(g => g.responseStatus !== "declined" && !!g.email && st.emailHashes.includes(lib.emailHash(g.email)));
      const unnamedAbsence = cal === "absences" && !names.some(n => word(n, ev.summary));
      if (named || unnamedAbsence) errors.push(`${day(s.start)} ${time(s.start)} ${st.name}: Überschneidung mit ${cal} ${time(new Date(x.s).toISOString())}`);
    }
    for (const p of data.personal?.[st.key]?.busy || []) if (Date.parse(p.start) < b && Date.parse(p.end) > a) errors.push(`${day(s.start)} ${time(s.start)} ${st.name}: eigener Kalender belegt`);
  }
  console.log(errors.length ? `FEHL ${errors.length} Kollisionen:\n  ${errors.join("\n  ")}` : `OK   keine Kollision (${slots.length} Starts geprüft)`);
  failed += errors.length;
}
process.exit(failed ? 1 : 0);
