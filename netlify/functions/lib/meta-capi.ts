/* Meta Conversions API: Purchase serverseitig an den Datensatz melden, sobald Magicline den Vertrag bestätigt hat.
   Dedupliziert mit dem Browser-Event über dieselbe event_id (Vertragsnummer). Kontaktdaten werden SHA-256-gehasht.
   Sendet nur, wenn META_CAPI_TOKEN gesetzt ist (Netlify-Umgebungsvariable). META_CAPI_TEST_CODE → Test-Ereignisse im Events Manager. */
import { createHash } from "node:crypto";

const PIXEL_ID = process.env.META_PIXEL_ID || "577923356905873";
const TOKEN = process.env.META_CAPI_TOKEN || "";
const TEST_CODE = process.env.META_CAPI_TEST_CODE || "";
export const capiConfigured = () => TOKEN.length > 20;

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const normEmail = (e: string) => e.trim().toLowerCase();
/** Telefon als Ziffern mit Ländervorwahl, deutsche Nummern ohne Vorwahl bekommen 49. */
function normPhone(p: string) {
  let d = p.replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "49" + d.slice(1); return d;
}

export interface CapiPurchase {
  eventId: string; value: number; currency?: string; contentName: string; sourceUrl: string; eventTime?: number;
  email: string; phone: string; firstName?: string; lastName?: string; zip?: string; city?: string;
  clientIp?: string; userAgent?: string; fbp?: string; fbc?: string;
}
export async function sendPurchase(p: CapiPurchase): Promise<{ sent: boolean; status?: number; body?: string; skipped?: string }> {
  if (!capiConfigured()) return { sent: false, skipped: "META_CAPI_TOKEN fehlt" };
  const user_data: Record<string, unknown> = {
    em: [sha(normEmail(p.email))], ph: p.phone ? [sha(normPhone(p.phone))] : undefined,
    fn: p.firstName ? [sha(p.firstName.trim().toLowerCase())] : undefined, ln: p.lastName ? [sha(p.lastName.trim().toLowerCase())] : undefined,
    zp: p.zip ? [sha(p.zip.trim())] : undefined, ct: p.city ? [sha(p.city.trim().toLowerCase().replace(/\s/g, ""))] : undefined, country: [sha("de")],
    client_ip_address: p.clientIp || undefined, client_user_agent: p.userAgent || undefined, fbp: p.fbp || undefined, fbc: p.fbc || undefined,
  };
  const body = {
    data: [{ event_name: "Purchase", event_time: p.eventTime || Math.floor(Date.now() / 1000), event_id: p.eventId, event_source_url: p.sourceUrl, action_source: "website",
      user_data, custom_data: { value: p.value, currency: p.currency || "EUR", content_name: p.contentName, content_type: "product" } }],
    ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
  };
  const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const txt = await r.text();
  return { sent: r.ok, status: r.status, body: txt.slice(0, 300) };
}
