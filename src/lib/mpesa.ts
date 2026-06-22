/**
 * M-Pesa integration via Cardano Eternl wallet.
 *
 * Flow:
 * 1. Buyer selects "M-Pesa" as payment method.
 * 2. Buyer enters their M-Pesa phone number (2547XXXXXXXX).
 * 3. App simulates an STK push to the buyer's phone (production: Safaricom Daraja API).
 * 4. Buyer confirms the M-Pesa payment on their phone.
 * 5. A bridge service locks equivalent ADA in the Cardano escrow smart contract.
 * 6. The Eternl wallet co-signs the escrow funding transaction.
 * 7. The escrow is now funded — milestones work the same as ADA-funded contracts.
 *
 * In production, the STK push + bridge would require a backend service that:
 *   - Calls Safaricom's Daraja API (STK Push)
 *   - Listens for the C2B confirmation callback
 *   - Converts KES → ADA at the current oracle rate
 *   - Submits the funding tx to the Cardano escrow validator
 *
 * For this MVP, we simulate the STK push and generate a mock M-Pesa code.
 */

/** Approximate KES→ADA conversion rate (testnet — not live market rate). */
export const KES_TO_ADA_RATE = 85; // 1 ADA ≈ 85 KES (adjustable)

/** Convert KES to ADA at the current rate. */
export function kesToAda(kes: number): number {
  return Math.ceil((kes / KES_TO_ADA_RATE) * 1_000_000) / 1_000_000;
}

/** Convert ADA to KES at the current rate. */
export function adaToKes(ada: number): number {
  return Math.round(ada * KES_TO_ADA_RATE);
}

/** Format KES with currency symbol. */
export function formatKes(kes: number): string {
  return `KES ${kes.toLocaleString()}`;
}

/**
 * Simulate an M-Pesa STK push.
 * In production, this would call Safaricom's Daraja API:
 *   POST https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
 *
 * Returns a mock M-Pesa transaction code after a delay.
 */
export async function simulateStkPush(
  phoneNumber: string,
  amountKes: number,
): Promise<{ mpesaCode: string; success: boolean }> {
  // Validate phone number (2547XXXXXXXX or 07XXXXXXXX)
  const cleaned = phoneNumber.replace(/\s|-/g, "");
  if (!/^2547\d{8}$|^07\d{8}$/.test(cleaned)) {
    throw new Error("Invalid M-Pesa phone number. Use format 2547XXXXXXXX or 07XXXXXXXX.");
  }

  if (amountKes <= 0) {
    throw new Error("Amount must be greater than 0 KES.");
  }

  // Simulate network delay for STK push
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Generate a mock M-Pesa code (format: QFG3KXYZ12)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const code = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return {
    mpesaCode: code,
    success: true,
  };
}

/** Validate an M-Pesa phone number. */
export function validateMpesaPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s|-/g, "");
  return /^2547\d{8}$|^07\d{8}$/.test(cleaned);
}

/** Normalize phone number to 2547XXXXXXXX format. */
export function normalizeMpesaPhone(phone: string): string {
  let cleaned = phone.replace(/\s|-/g, "");
  if (cleaned.startsWith("07")) {
    cleaned = "254" + cleaned.slice(1);
  }
  return cleaned;
}
