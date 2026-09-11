export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin";

/**
 * تحقق الخادم من رمز الإدارة المُدخل في بوابة /admin:
 * (بعد حذف طبقة Neon في المرحلة 2 لم تعد هناك مسارات /api إدارية للبيانات،
 *  وبقيت هذه النقطة الوحيدة التي تقارن الرمز بقيمة RAKSHTAK_ADMIN_TOKEN على الخادم)
 */
export async function POST(request: NextRequest) {
  const expected = process.env.RAKSHTAK_ADMIN_TOKEN || "";

  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "الإدارة مقفولة: RAKSHTAK_ADMIN_TOKEN غير مضبوط على الخادم (أضفه في Vercel ثم أعد النشر).",
      },
      { status: 403 }
    );
  }

  try {
    const { token } = await request.json();
    const provided = typeof token === "string" ? token.trim() : "";
    if (!provided || !safeEqual(provided, expected)) {
      return NextResponse.json({ ok: false, error: "رمز الإدارة غير صحيح" }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "طلب غير صالح" }, { status: 400 });
  }
}
