/* POST /api/book → Kurs buchen. Reihenfolge: Ticket-Guthaben → Magicline-Mitglied → offen (pending, Team klärt). */
import type { Config } from "@netlify/functions";
import { json, normEmail, validEmail, randomToken, berlinDate, SITE } from "./lib/util";
import { listSlots, magiclineConfigured, findCustomerByEmail, validateBooking, bookSlot } from "./lib/magicline";
import { mockSlots } from "./lib/mock";
import { bookingsForSlot, saveBooking, getTicket, saveTicket } from "./lib/store";
import { sendBookingMails } from "./lib/notify";
import type { Booking, Slot } from "./lib/types";

async function findSlot(id: string): Promise<Slot | null> {
  const from = berlinDate(new Date());
  const slots = magiclineConfigured() ? await listSlots(from, 7) : mockSlots(from, 7);
  return slots.find(s => s.id === id) || null;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ error: "Ungültige Anfrage" }, 400); }
  const firstName = String(body.firstName || "").trim(), lastName = String(body.lastName || "").trim(), phone = String(body.phone || "").trim();
  const email = normEmail(String(body.email || "")); const slotId = String(body.slotId || "");
  if (!firstName || !lastName || !validEmail(email) || phone.replace(/\D/g, "").length < 6 || !slotId) return json({ error: "Bitte Vorname, Nachname, E-Mail und Handynummer ausfüllen." }, 400);
  if (body.privacy !== true) return json({ error: "Bitte Datenschutz bestätigen." }, 400);
  if (String(body.website || "")) return json({ ok: true }); // Honeypot

  const slot = await findSlot(slotId);
  if (!slot) return json({ error: "Dieser Kurs ist nicht mehr im Kursplan." }, 404);
  if (!slot.bookable || new Date(slot.start).getTime() < Date.now()) return json({ error: "Dieser Kurs kann nicht mehr gebucht werden." }, 409);
  const existing = await bookingsForSlot(slotId);
  if (existing.some(b => b.status !== "cancelled" && b.email === email)) return json({ error: "Du bist für diesen Kurs schon gebucht." }, 409);
  const localActive = existing.filter(b => b.status !== "cancelled").length;
  if (slot.max - slot.booked - (slot.source === "magicline" ? localActive : 0) <= 0) return json({ error: "Dieser Kurs ist voll." }, 409);

  const booking: Booking = { id: randomToken(12), token: randomToken(24), slotId, slotName: slot.name, start: slot.start, end: slot.end,
    firstName, lastName, email, phone, status: "pending", entitlement: "none", createdAt: new Date().toISOString() };

  /* 1. Ticket-Guthaben aus dem Shop */
  const ticket = await getTicket(email);
  const ticketValid = ticket && ticket.credits > 0 && (!ticket.validUntil || ticket.validUntil >= berlinDate(new Date()));
  if (ticketValid && ticket) {
    ticket.credits -= 1; ticket.updatedAt = new Date().toISOString(); await saveTicket(ticket);
    booking.entitlement = "ticket"; booking.ticketCreditUsed = true; booking.status = "confirmed";
    booking.note = `Ticket: ${ticket.credits} Kurse übrig`;
  }
  /* 2. Mitglied in Magicline: dort buchen, Magicline prüft Berechtigung und Kapazität */
  if (booking.entitlement === "none" && magiclineConfigured() && slot.source === "magicline") {
    try {
      const c = await findCustomerByEmail(email);
      if (c) {
        booking.magiclineCustomerId = c.id;
        const v = await validateBooking(c.id, Number(slotId));
        if (v.bookable) { booking.magiclineBookingId = await bookSlot(c.id, Number(slotId)); booking.entitlement = "member"; booking.status = "confirmed"; }
        else booking.note = "Magicline: Kunde gefunden, Buchung nicht erlaubt (Vertrag/Kontingent prüfen)";
      } else booking.note = "Magicline: keine Kundin/kein Kunde mit dieser E-Mail";
    } catch (e: any) { booking.note = "Magicline-Fehler: " + String(e?.message || e).slice(0, 160); }
  }
  /* 3. Testmodus: lokal bestätigen */
  if (booking.entitlement === "none" && slot.source === "mock") { booking.status = "confirmed"; booking.note = "Testdaten, lokale Buchung"; }

  await saveBooking(booking);
  const mails = await sendBookingMails(booking).catch(() => ({ customer: false, staff: false }));
  return json({ ok: true, status: booking.status, bookingId: booking.id, cancelUrl: `${SITE}/api/cancel?id=${booking.id}&t=${booking.token}`, entitlement: booking.entitlement, mailSent: mails.customer,
    creditsLeft: booking.entitlement === "ticket" ? ticket?.credits : undefined });
};
export const config: Config = { path: "/api/book" };
