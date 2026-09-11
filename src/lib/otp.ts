import { createHash, randomInt, randomBytes } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * OTP — رمز تحقق حقيقي (المرحلة 2):
 * رمز عشوائي 6 خانات، يُخزَّن مبشوراً (SHA-256) في جدول otp_codes على Supabase،
 * بصلاحية 5 دقائق وحد أقصى 5 محاولات، ويُحذف بعد الاستخدام.
 */

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export function hashOtp(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function newSessionToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * إرسال الرمز للسائق:
 * 1) إن وُجد RAKSHTAK_OTP_WEBHOOK_URL يُرسل له الرمز (WhatsApp/SMS gateway).
 * 2) خارج بيئة الإنتاج بدون webhook: يُعاد الرمز في الاستجابة كـ previewCode
 *    (تسهيل للتجربة المحلية والمعاينة فقط — لا يُفعَّل في production أبداً).
 * 3) في الإنتاج بدون webhook: 503 (الوضع الآمن — لا دخول وهمياً).
 */
export async function deliverOtpCode(
  phone: string,
  code: string
): Promise<{ ok: boolean; status?: number; error?: string; previewCode?: string }> {
  const webhook = process.env.RAKSHTAK_OTP_WEBHOOK_URL;

  if (webhook) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return { ok: true };
      return { ok: false, status: 502, error: "مزوّد إرسال الرمز رفض الطلب" };
    } catch {
      return { ok: false, status: 502, error: "تعذر الوصول لمزوّد إرسال الرمز" };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return { ok: true, previewCode: code };
  }

  return {
    ok: false,
    status: 503,
    error: "مزوّد إرسال الرمز غير مضبوط (RAKSHTAK_OTP_WEBHOOK_URL) — تعذّر إرسال رمز التحقق",
  };
}

/** إصدار رمز جديد لرقم (يحذف أي رموز سابقة معلّقة له) */
export async function issueOtp(
  phone: string
): Promise<{
  ok: boolean;
  error?: string;
  status?: number;
  previewCode?: string;
}> {
  const admin = getSupabaseAdmin();
  const code = generateOtpCode();

  // تنظيف الرموز القديمة المعلّقة لهذا الرقم
  await admin.from("otp_codes").delete().eq("phone", phone);

  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  const { error } = await admin.from("otp_codes").insert({
    phone,
    code_hash: hashOtp(phone, code),
    expires_at: expiresAt,
    attempts: 0,
  });

  if (error) {
    return { ok: false, error: "تعذر حفظ رمز التحقق: " + error.message };
  }

  const delivery = await deliverOtpCode(phone, code);
  if (!delivery.ok) {
    await admin
      .from("otp_codes")
      .delete()
      .eq("phone", phone)
      .eq("code_hash", hashOtp(phone, code));
    return { ok: false, error: delivery.error, status: delivery.status };
  }
  return delivery.previewCode
    ? { ok: true, previewCode: delivery.previewCode }
    : { ok: true };
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** التحقق من رمز: صلاحية زمنية + عدد محاولات + تطابق البصمة */
export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  const admin = getSupabaseAdmin();
  const cleanCode = (code || "").replace(/\D/g, "").slice(0, 6);
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, status: 400, error: "الرمز يجب أن يكون 6 أرقام" };
  }

  const { data, error } = await admin
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return { ok: false, status: 400, error: "لا يوجد رمز صادر لهذا الرقم — اطلب رمزاً جديداً" };
  }

  const row = data[0];

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from("otp_codes").delete().eq("id", row.id);
    return { ok: false, status: 400, error: "انتهت صلاحية الرمز — اطلب رمزاً جديداً" };
  }

  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    await admin.from("otp_codes").delete().eq("id", row.id);
    return { ok: false, status: 429, error: "محاولات كثيرة — اطلب رمزاً جديداً" };
  }

  if (hashOtp(phone, cleanCode) !== row.code_hash) {
    await admin.from("otp_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
    return { ok: false, status: 401, error: "الرمز غير صحيح — تحقق وأعد المحاولة" };
  }

  // نجاح: إتلاف الرمز فوراً (منع إعادة الاستخدام)
  await admin.from("otp_codes").delete().eq("phone", phone);
  return { ok: true };
}
