import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverOtps } from "@/db/schema";
import { eq } from "drizzle-orm";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 دقائق

/** توليد رمز تحقق مكوّن من 6 أرقام */
function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ===== POST: طلب رمز تحقق لرقم هاتف السائق =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone } = body;

    if (typeof phone !== "string" || !/^\+249[19]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "رقم هاتف سوداني غير صحيح" },
        { status: 400 }
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // إلغاء أي رموز سابقة غير مستخدمة لنفس الرقم (اختياري لكن أنظف)
    await db.delete(driverOtps).where(eq(driverOtps.phone, phone));

    await db.insert(driverOtps).values({
      phone,
      code,
      expiresAt,
      consumed: false,
    });

    // TODO: دمج مزوّد SMS حقيقي (Twilio/آخر) هنا لإرسال الرمز فعلياً.
    // في غياب مزوّد فعّال، نُرجع الرمز في previewCode لأغراض التطوير فقط.
    const hasSmsProvider = false;

    return NextResponse.json({
      ok: true,
      message: hasSmsProvider
        ? "تم إرسال رمز التحقق إلى هاتفك عبر رسالة نصية"
        : "وضع تجريبي: لا يوجد مزوّد رسائل نصية مفعّل حالياً",
      previewCode: hasSmsProvider ? null : code,
    });
  } catch (error) {
    console.error("❌ Error requesting OTP:", error);
    return NextResponse.json(
      { ok: false, error: "تعذر إرسال رمز التحقق" },
      { status: 500 }
    );
  }
}
