import { createHmac } from "crypto";

/**
 * توكن السائق: يحمل معرّف السائق (driverId) وتاريخ انتهاء، موقّع بـ HMAC
 * حتى لا نحتاج جدول جلسات منفصل في قاعدة البيانات.
 * الصيغة: base64(driverId.expiresAtMs).signatureHex
 */

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 يوماً

function getSecret(): string {
  // يفضّل ضبط RAKSHTAK_DRIVER_SECRET في متغيرات بيئة Vercel.
  // في غيابه نستخدم قيمة احتياطية — يُنصح بشدة بضبط المتغير فعلياً.
  return process.env.RAKSHTAK_DRIVER_SECRET || "rakshtak-fallback-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/** توليد توكن سائق جديد */
export function signDriverToken(driverId: number): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${driverId}.${expiresAt}`;
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(payload);
  return `${payloadB64}.${signature}`;
}

/** التحقق من توكن سائق، يرجع driverId أو null إذا كان غير صالح/منتهي */
export function verifyDriverToken(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSignature = sign(payload);
  if (signature !== expectedSignature) return null;

  const [idStr, expiresAtStr] = payload.split(".");
  const driverId = Number(idStr);
  const expiresAt = Number(expiresAtStr);
  if (!Number.isInteger(driverId) || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  return driverId;
}

/** استخراج driverId من طلب Next.js عبر ترويسة x-driver-token */
export function getDriverIdFromRequest(request: Request): number | null {
  const token = request.headers.get("x-driver-token");
  return verifyDriverToken(token);
}
