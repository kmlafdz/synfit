import midtransClient from "midtrans-client";
import crypto from "crypto";

const isProduction =
  process.env.MIDTRANS_IS_PRODUCTION === "true" ||
  process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";

const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";

export const snap = new midtransClient.Snap({
  isProduction,
  serverKey,
  clientKey,
});

export const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey,
  clientKey,
});

/**
 * Cek status transaksi langsung ke Midtrans API
 */
export async function checkMidtransStatus(orderId: string): Promise<any> {
  if (!serverKey) return null;
  try {
    return await (coreApi as any).transaction.status(orderId);
  } catch (error) {
    // Fallback: direct REST request to Midtrans v2 API
    try {
      const baseUrl = isProduction
        ? "https://api.midtrans.com/v2"
        : "https://api.sandbox.midtrans.com/v2";
      const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");
      const res = await fetch(`${baseUrl}/${encodeURIComponent(orderId)}/status`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Direct Midtrans REST check error:", e);
    }
    throw error;
  }
}

export interface SnapTransactionParams {
  orderId: string;
  grossAmount: number;
  customerDetails?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    billing_address?: {
      address?: string;
    };
  };
  itemDetails?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
}

export async function createMidtransTransaction(params: SnapTransactionParams) {
  if (!serverKey || serverKey.includes("xxxx")) {
    throw new Error(
      "MIDTRANS_SERVER_KEY belum dikonfigurasikan dengan benar di .env.local"
    );
  }

  const parameter = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: Math.round(params.grossAmount),
    },
    customer_details: params.customerDetails,
    item_details: params.itemDetails,
    credit_card: {
      secure: true,
    },
    callbacks: {
      finish: `${process.env.APP_BASE_URL || ""}/member/dashboard?payment=finish`,
      error: `${process.env.APP_BASE_URL || ""}/member/dashboard?payment=error`,
      pending: `${process.env.APP_BASE_URL || ""}/member/dashboard?payment=pending`,
    },
  };

  const transaction = await snap.createTransaction(parameter);
  return {
    token: transaction.token as string,
    redirectUrl: transaction.redirect_url as string,
  };
}

/**
 * Verifikasi signature webhook dari Midtrans:
 * SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  if (!serverKey) return false;

  const hash = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");

  return hash.toLowerCase() === (signatureKey || "").toLowerCase();
}

