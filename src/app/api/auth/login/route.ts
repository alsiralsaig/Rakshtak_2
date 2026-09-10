import { NextRequest, NextResponse } from "next/server";

/**
 * ⛔ إلغاء الرمز الثابت "1234":
 * كان المسار يردّ دائماً "تم إرسال الرمز (في التجربة: 1234)" ويقبل أي رمز 1234،
 * أي أن أي شخص يعرف رقم هاتف أي مستخدم كان يستطيع الدخول بحسابه.
 *
 * الوضع الآن: الخدمة موقوفة (503) ريثما تُفعَّل خدمة OTP حقيقية
 * (توليد رمز عشوائي + إرسال عبر مزوّد + تخزين مقيّد الزمن — المرحلة 2).
 * التعطيل المتعمّد خير من بقاء باب مفتوح برمز معروف للجميع.
 */
const OTP_DISABLED_MESSAGE =
  "خدمة رمز التحقق غير متاحة حالياً — أُوقف تسجيل الدخول بالرمز مؤقتاً لحين تفعيل مزوّد OTP حقيقي.";

/** تطبيع بسيط لرقم الهاتف على الخادم (نفس صيغة التطبيق: +2499XXXXXXXX) */
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("249")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^9\d{8}$/.test(digits) ? `+249${digits}` : null;
}

// ===== إرسال رمز التحقق =====
export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!normalizePhone(phone)) {
      return NextResponse.json(
        { error: "رقم الهاتف السوداني غير صحيح (9 أرقام تبدأ بـ 9)" },
        { status: 400 }
      );
    }

    // أُوقف الإرسال الوهمي نهائياً — لا يوجد بعد أي رمز "تجريبي" يُقبل
    return NextResponse.json({ error: OTP_DISABLED_MESSAGE }, { status: 503 });
  } catch (error) {
    console.error("Auth login error:", error);
    return NextResponse.json(
      { error: "فشل طلب رمز التحقق" },
      { status: 500 }
    );
  }
}

// ===== التحقق من الرمز =====
export async function PUT() {
  // لا يوجد رمز يُخزَّن ولا رمز ثابت يُقارَن به — الخدمة موقوفة بنفس الرسالة
  return NextResponse.json({ error: OTP_DISABLED_MESSAGE }, { status: 503 });
}
