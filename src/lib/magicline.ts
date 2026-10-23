/** Magicline Connect API client. Public, no key. Docs: developer.sportalliance.com/apis/magicline/connectapi */
export const API = "https://skillathletic.api.magicline.com/connect/v1";
export const STUDIO_ID = 1210006110;

/** Tarife. Magicline-IDs für SKILL Mitgliedschaft und SKILL Unlimited liefert Boris (rateBundleId = Vertragsangebot, term12Id/term1Id = Tarif je Laufzeit).
 *  Solange eine ID null ist, warnt der Build (scripts/check-offers.mjs) und die Seite sucht das Angebot über den Namen im rate-bundle. */
export interface OfferIds { rateBundleId: number | null; term12Id: number | null; term1Id: number | null }
export const OFFERS = {
  start39: { bundle: "START 39", title: "START 39", value: 39, prices: { year: null as number | null, monthly: 39 }, ids: null as OfferIds | null,
    desc: "39 € je 4 Wochen. 4 Classes im Monat. Monatlich kündbar. Getränke, Dusche und Handtuch inklusive. Keine Gebühr. Nur online, nur Neukunden." },
  mitgliedschaft: { bundle: "SKILL Mitgliedschaft", title: "SKILL Mitgliedschaft", value: 89, prices: { year: 89 as number | null, monthly: 109 }, ids: { rateBundleId: 1215083700, term12Id: 1215083720, term1Id: 1215083710 } as OfferIds | null,
    desc: "Gym ohne Limit, 6 Classes je vier Wochen, 3D Scan zum Start und alle 12 Wochen, Plan mit deinem Namen, Parken 2 mal pro Woche. 89 € alle vier Wochen bei 12 Monaten, 109 € monatlich kündbar. Keine Gebühr." },
  unlimited: { bundle: "SKILL Unlimited", title: "SKILL Unlimited", value: 129, prices: { year: 129 as number | null, monthly: 149 }, ids: { rateBundleId: 1215083701, term12Id: 1215083740, term1Id: 1215083711 } as OfferIds | null,
    desc: "Gym ohne Limit, alle Classes, 3D Scan alle 8 Wochen, Coach Gespräch einmal im Monat, Parken 3 mal pro Woche. 129 € alle vier Wochen bei 12 Monaten, 149 € monatlich kündbar. Keine Gebühr." },
} as const;
export type OfferKey = keyof typeof OFFERS;
/** START 39: Laufzeit 1 Monat (Stand 2026-10-22). Vertragsangebot 1214568070, Tarif-ID 1214567320, Laufzeit-Term 1214571340. Der 12-Wochen-Term 1215083690 wird nicht mehr verwendet. */
export const START39_TERM_ID = 1214571340;

export interface FlatFee { name: string; price: number }
export interface RateBundleTerm {
  id: number; price: number;
  termValue: number; termUnit: "MONTH" | "WEEK" | "DAY" | "YEAR" | string;
  paymentFrequencyValue: number; paymentFrequencyUnit: "MONTH" | "WEEK" | "DAY" | "YEAR" | string;
  cancellationPeriod?: number; cancellationPeriodUnit?: string;
  defaultContractStartDate?: string; flatFees?: FlatFee[];
}
export interface RateBundle { id: number; name: string; terms: RateBundleTerm[] }

export async function getRateBundles(): Promise<RateBundle[]> {
  const r = await fetch(`${API}/rate-bundle?studioId=${STUDIO_ID}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("rate-bundle " + r.status);
  return r.json();
}

/** SEPA-Mandatstext aus Magicline, fällt bei Fehler auf null zurück. */
export async function getSepaAgreement(rateBundleId: number): Promise<string | null> {
  try {
    const r = await fetch(`${API}/studio/${STUDIO_ID}/rate/${rateBundleId}/sepa/agreement?language=de-DE`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j.text || j.content || j.agreement || null;
  } catch { return null; }
}

/** Interessent anlegen. Antwort: { id, customerNumber, uuid }. Die uuid ist der identityToken für den späteren Vertrag,
 *  damit der Interessent selbst zum Mitglied wird und kein zweiter Kunde entsteht. */
export interface LeadResult { ok: boolean; status: number; uuid: string; customerNumber: string }
export async function createLead(input: { firstname: string; lastname: string; email: string; phone: string; notes: string }, opts: { keepalive?: boolean } = {}): Promise<LeadResult> {
  const r = await fetch(`${API}/lead`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, keepalive: opts.keepalive,
    body: JSON.stringify({ studioId: STUDIO_ID, ...input, locale: "de_DE", countryCode: "DE",
      privacyConfiguration: { email: true, phone: true, textMessage: true } }),
  });
  let j: any = {}; try { j = await r.json(); } catch {}
  return { ok: r.ok || r.status === 409, status: r.status, uuid: r.ok && typeof j?.uuid === "string" ? j.uuid : "", customerNumber: r.ok && j?.customerNumber ? String(j.customerNumber) : "" };
}

export interface ContractInput {
  rateBundleTermId: number; startDate: string; signatureSvgBase64: string; notes: string;
  firstname: string; lastname: string; email: string; phone: string; dob: string; gender?: string;
  street: string; houseNumber: string; zip: string; city: string; accountHolder: string; iban: string;
  /** uuid des Interessenten aus createLead: Magicline nutzt dann diesen Kunden statt einen neuen anzulegen. */
  identityToken?: string;
}
export async function createContract(i: ContractInput) {
  const payload = {
    studioId: STUDIO_ID,
    contract: { rateBundleTermId: i.rateBundleTermId, startDate: i.startDate,
      contractSignature: { base64Svg: i.signatureSvgBase64 }, sepaSignature: { base64Svg: i.signatureSvgBase64 }, notes: i.notes.slice(0, 300) },
    customer: { ...(i.identityToken ? { identityToken: i.identityToken } : {}), firstname: i.firstname, lastname: i.lastname, email: i.email, telephone_mobile: i.phone, dateOfBirth: i.dob,
      gender: i.gender || "UNISEX", street: i.street, houseNumber: i.houseNumber, zipCode: i.zip, city: i.city, countryCode: "DE",
      language: "de", locale: "de_DE", paymentChoice: "DIRECT_DEBIT",
      bankAccount: { accountHolder: i.accountHolder, iban: i.iban.replace(/\s+/g, "").toUpperCase() },
      privacyConfiguration: { email: true, phone: true, textMessage: true, letter: false, mySportsMessage: true } },
  };
  const r = await fetch(`${API}/rate-bundle`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
  const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
  const result: ContractResult = { status: r.status, raw: txt.slice(0, 2000), contractId: j?.id != null && String(j.id) !== String(j.customerId ?? "") ? String(j.id) : "", customerId: j?.customerId != null ? String(j.customerId) : "", customerNumber: j?.customerNumber || "", paymentUrl: j?.paymentUrl || null, followUpActionToken: j?.followUpActionToken || null };
  if (!r.ok) throw new ContractError(j?.message || j?.errorMessage || j?.error || txt || `HTTP ${r.status}`, result);
  /* Antwort: { id = Vertrags-ID, customerId, customerNumber, customerName, followUpActionToken, paymentUrl }. Ohne id gilt der Abschluss als gescheitert. */
  if (!result.contractId) throw new ContractError("Magicline hat keine Vertragsnummer zurückgegeben", result);
  return result;
}
export interface ContractResult { status: number; raw: string; contractId: string; customerId: string; customerNumber: string; paymentUrl: string | null; followUpActionToken: string | null }
export class ContractError extends Error { result: ContractResult; constructor(message: string, result: ContractResult) { super(message); this.name = "ContractError"; this.result = result; } }

export function ibanValid(v: string) {
  v = v.replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  const s = v.slice(4) + v.slice(0, 4); let n = ""; for (const c of s) { const code = c.charCodeAt(0); n += code >= 65 ? String(code - 55) : c; }
  let m = 0; for (let j = 0; j < n.length; j += 7) m = parseInt(String(m) + n.substr(j, 7), 10) % 97; return m === 1;
}

/** Formatierung für Preise, Laufzeiten und Gebühren aus dem rate-bundle. */
export const euro = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
export function termLabel(t: RateBundleTerm) {
  if (t.termValue === 1 && t.termUnit === "MONTH") return "Monatlich kündbar";
  return `${t.termValue} ${t.termUnit === "MONTH" ? "Monate" : t.termUnit === "WEEK" ? "Wochen" : t.termUnit}`;
}
export function termFreq(t: RateBundleTerm) {
  const u = ({ WEEK: "Woche", MONTH: "Monat", DAY: "Tag", YEAR: "Jahr" } as Record<string, string>)[t.paymentFrequencyUnit] || t.paymentFrequencyUnit;
  if (t.paymentFrequencyValue === 1) return "je " + u;
  return `alle ${t.paymentFrequencyValue} ${u === "Woche" ? "Wochen" : u === "Monat" ? "Monate" : u}`;
}
export function termFees(t: RateBundleTerm) { return (t.flatFees || []).map(f => `${f.name} ${euro(f.price)}`).join(", ") || "keine"; }
export function termCancel(t: RateBundleTerm) {
  const u = ({ MONTH: "Monat", WEEK: "Wochen", DAY: "Tage" } as Record<string, string>)[t.cancellationPeriodUnit || ""] || "Monat";
  return `Kündigungsfrist ${t.cancellationPeriod || 1} ${u}`;
}

export const GOOGLE_BOOKING = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ10Q9b0R58FnSdP-dGHz83yuMPl6-TThwqGT7vfjM5tQvev-5VY4cVyRr1p1uO0ZihxqkxMAWt0";
export const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID || "577923356905873").trim();
export const WHATSAPP = "https://wa.me/4917610877603";
export const PHONE = "+49 221 70093636";
export const PHONE_HREF = "tel:+4922170093636";
