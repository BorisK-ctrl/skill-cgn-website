/* Magicline Connect API serverseitig (ohne Schlüssel, wie im Browser): Vertrag für einen bestehenden Interessenten anlegen.
   Genutzt vom Stripe-Webhook: Kartenkunden bekommen einen Magicline-Vertrag mit Zahlart BANK_TRANSFER, Stripe zieht das Abo ein. */
const API = "https://skillathletic.api.magicline.com/connect/v1";
const STUDIO_ID = 1210006110;

export interface ServerContractInput {
  rateBundleTermId: number; startDate: string; signatureSvgBase64: string; notes: string; identityToken?: string;
  firstname: string; lastname: string; email: string; phone: string; dob: string;
  street: string; houseNumber: string; zip: string; city: string;
  paymentChoice: "BANK_TRANSFER" | "DIRECT_DEBIT"; iban?: string; accountHolder?: string;
}
export async function createContractServer(i: ServerContractInput): Promise<{ ok: boolean; status: number; contractId: string; customerId?: string; customerNumber: string; raw: string }> {
  /* MAGICLINE_DRY_RUN=1 nur lokal: kein Vertrag im echten System */
  if (process.env.MAGICLINE_DRY_RUN === "1") { console.log(`[magicline dry-run] contract ${i.firstname} ${i.lastname} <${i.email}> term ${i.rateBundleTermId} start ${i.startDate}`); return { ok: true, status: 200, contractId: "DRY-RUN", customerNumber: "DRY-RUN", raw: "" }; }
  const payload = {
    studioId: STUDIO_ID,
    contract: { rateBundleTermId: i.rateBundleTermId, startDate: i.startDate, contractSignature: { base64Svg: i.signatureSvgBase64 }, sepaSignature: { base64Svg: i.signatureSvgBase64 }, notes: i.notes.slice(0, 300) },
    customer: { ...(i.identityToken ? { identityToken: i.identityToken } : {}), firstname: i.firstname, lastname: i.lastname, email: i.email, telephone_mobile: i.phone, dateOfBirth: i.dob,
      gender: "UNISEX", street: i.street, houseNumber: i.houseNumber, zipCode: i.zip, city: i.city, countryCode: "DE", language: "de", locale: "de_DE", paymentChoice: i.paymentChoice,
      ...(i.paymentChoice === "DIRECT_DEBIT" && i.iban ? { bankAccount: { accountHolder: i.accountHolder || `${i.firstname} ${i.lastname}`, iban: i.iban.replace(/\s+/g, "").toUpperCase() } } : {}),
      privacyConfiguration: { email: true, phone: true, textMessage: true, letter: false, mySportsMessage: true } },
  };
  const r = await fetch(`${API}/rate-bundle`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
  const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
  const contractId = j?.id != null && String(j.id) !== String(j.customerId ?? "") ? String(j.id) : "";
  return { ok: r.ok && !!contractId, status: r.status, contractId, customerId: j?.customerId != null ? String(j.customerId) : undefined, customerNumber: j?.customerNumber ? String(j.customerNumber) : "", raw: txt.slice(0, 1500) };
}

/** Interessent anlegen wie im Browser (src/lib/magicline.ts createLead). uuid = identityToken für den Vertrag. */
export async function createLeadServer(i: { firstname: string; lastname: string; email: string; phone: string; notes: string }): Promise<{ ok: boolean; status: number; uuid: string; customerNumber: string }> {
  /* MAGICLINE_DRY_RUN=1 nur lokal: kein Aufruf an Magicline, keine Testkunden im echten System. */
  if (process.env.MAGICLINE_DRY_RUN === "1") { console.log(`[magicline dry-run] lead ${i.firstname} ${i.lastname} <${i.email}> ${i.phone}: ${i.notes}`); return { ok: true, status: 200, uuid: "dry-run", customerNumber: "DRY-RUN" }; }
  const r = await fetch(`${API}/lead`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ studioId: STUDIO_ID, ...i, notes: i.notes.slice(0, 300), locale: "de_DE", countryCode: "DE", privacyConfiguration: { email: true, phone: true, textMessage: true } }) });
  let j: any = {}; try { j = await r.json(); } catch {}
  return { ok: r.ok || r.status === 409, status: r.status, uuid: r.ok && typeof j?.uuid === "string" ? j.uuid : "", customerNumber: r.ok && j?.customerNumber ? String(j.customerNumber) : "" };
}
