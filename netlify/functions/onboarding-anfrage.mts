/* POST /api/onboarding/anfrage → Wunschtermin fürs Onboarding, solange der Kalender ohne Google-Zugang läuft (lib/anfrage.ts).
   Body: {start, firstname, lastname, email, phone, vertrag?, note?} oder auf der Dankeseite {start, ct, cid, note?}: ct ist der Checkout-Token,
   er liegt nur im Browser des Käufers. Dann kommen Name, E-Mail und Telefon aus dem Kauf, der Kunde tippt nur die Zeit an.
   Antworten: {ok, start, end, firstName} · 409 {gone} Zeit nicht (mehr) wählbar · 400 {field} Eingabe fehlt · 400 {needForm} Kauf nicht gefunden,
   Formular zeigen · 429 Bremse (10 je Anschluss und Stunde) · 502 Teammail ging nicht raus, Kunde tippt noch einmal (kein Doppel). */
import type { Config } from "@netlify/functions";
import { json, validEmail, clientKey } from "./lib/util";
import { getCheckoutLead, allowHit, getAnfrage, saveAnfrage } from "./lib/store";
import { anfrageStart, ANFRAGE_MIN, sendAnfrageTeam, sendAnfrageKunde, type Anfrage } from "./lib/anfrage";

const TOKEN = /^[a-z0-9]{16,48}$/; // wie checkout-lead
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanName = (v: unknown) => clean(v, 80).replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
const SAME_MS = 30 * 60000; // gleiche Person, gleiche Zeit innerhalb von 30 Minuten = Doppeltipp

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const raw = await req.json().catch(() => null);
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (clean(b.website, 200)) return json({ ok: true }); // Honigtopf: Bots bekommen ein Ok, es passiert nichts

  const start = anfrageStart(b.start);
  if (!start) return json({ error: "Diese Zeit ist nicht mehr wählbar. Bitte wähle eine andere.", gone: true }, 409);
  const ok = await allowHit("onbanfrage/" + clientKey(req), 10, 3600000).catch(() => true);
  if (!ok) return json({ error: "Zu viele Anfragen. Bitte versuch es in einer Stunde noch einmal." }, 429);

  /* Person: aus dem Kauf (Dankeseite) oder aus dem Formular */
  let person: Omit<Anfrage, "start" | "end" | "note"> | null = null;
  const ct = String(b.ct ?? "");
  if (TOKEN.test(ct)) {
    const l = await getCheckoutLead(ct).catch(() => null);
    const email = (l?.email || "").trim().toLowerCase(), cid = clean(b.cid, 40);
    if (l && validEmail(email) && (!cid || !l.contractId || cid === l.contractId))
      person = { name: cleanName(`${l.firstName} ${l.lastName}`) || "Neues Mitglied", email, phone: clean(l.phone, 40), contract: l.contractId || undefined, offer: clean(l.campaign, 60) || undefined, verified: !!(l.done && l.contractId) };
  }
  if (!person) {
    if (b.firstname === undefined && b.email === undefined) return json({ error: "Bitte trag kurz deine Daten ein.", needForm: true }, 400);
    const firstName = cleanName(b.firstname), lastName = cleanName(b.lastname), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 40), vertrag = clean(b.vertrag, 20).replace(/[^\dA-Za-z-]/g, "");
    if (!firstName || !lastName) return json({ error: "Bitte Vor- und Nachnamen eintragen (nur Buchstaben).", field: "name" }, 400);
    if (!validEmail(email)) return json({ error: "Bitte eine gültige E-Mail-Adresse eintragen.", field: "email" }, 400);
    if (phone.replace(/\D/g, "").length < 6) return json({ error: "Bitte eine Handynummer mit mindestens 6 Ziffern eintragen.", field: "phone" }, 400);
    person = { name: `${firstName} ${lastName}`, email, phone, contract: vertrag || undefined, verified: false };
  }
  const note = clean(b.note, 300);
  const a: Anfrage = { ...person, start: start.toISOString(), end: new Date(start.getTime() + ANFRAGE_MIN * 60000).toISOString(), ...(note ? { note } : {}) };

  /* Doppeltipp: nichts doppelt mailen, nur fehlende Mails nachholen. Kundenmail erst, wenn das Team die Anfrage hat. */
  const prev = await getAnfrage(a.email).catch(() => null);
  const same = !!prev && prev.start === a.start && Date.now() - Date.parse(prev.at) < SAME_MS;
  const mails = same ? { ...prev!.mails } : { staff: false, customer: false };
  if (!mails.staff) mails.staff = await sendAnfrageTeam(a).catch(e => { console.log("anfrage team", String(e)); return false; });
  if (mails.staff && !mails.customer) mails.customer = await sendAnfrageKunde(a).catch(e => { console.log("anfrage kunde", String(e)); return false; });
  await saveAnfrage({ ...a, at: same ? prev!.at : new Date().toISOString(), mails }).catch(e => console.log("anfrage speichern", String(e)));
  if (!mails.staff) return json({ error: "Deine Anfrage ging gerade nicht raus. Bitte noch einmal tippen." }, 502);
  console.log(`anfrage: ${a.start} (${a.verified ? "Kauf" : "Formular"}), Mail Kunde ${mails.customer ? "ok" : "fehlt"}`);
  return json({ ok: true, start: a.start, end: a.end, firstName: a.name.split(" ")[0] });
};
export const config: Config = { path: "/api/onboarding/anfrage" };
