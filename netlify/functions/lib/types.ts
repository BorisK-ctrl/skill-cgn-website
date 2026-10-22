export interface Slot {
  id: string; name: string; description?: string; start: string; end: string; trainer: string;
  max: number; booked: number; free: number; bookable: boolean; source: "magicline" | "mock";
}
export interface Booking {
  id: string; token: string; slotId: string; slotName: string; start: string; end: string;
  firstName: string; lastName: string; email: string; phone: string;
  status: "confirmed" | "pending" | "cancelled"; entitlement: "member" | "ticket" | "none";
  magiclineBookingId?: number; magiclineCustomerId?: number; ticketCreditUsed?: boolean;
  createdAt: string; cancelledAt?: string; note?: string;
}
export interface TicketAccount {
  email: string; firstName: string; lastName: string; phone: string;
  credits: number; ptCredits: number; validUntil: string | null; purchases: { product: string; sessionId: string; credits: number; at: string }[];
  stripeCustomerId?: string; updatedAt: string;
}
