import { NextRequest, NextResponse } from "next/server";

/**
 * الترويسة التي يحملها أي طلب إداري:
 *   x-admin-token: <قيمة RAKSHTAK_ADMIN_TOKEN>
 * (يقبل أيضاً Authorization: Bearer <الرمز>)
 */
export const ADMIN_TOKEN_HEADER = "x-admin-token";

/** مقارنة ثابتة الزمن (تجنّب هجمات التوقيت) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * بوابة الحماية لكل المسارات الإدارية:
 * - بدون إعداد RAKSHTAK_ADMIN_TOKEN على الخادم ← ممنوع (403) (الوضع الآمن المتعمّد)
 * - بترويسة خاطئة أو ناقصة ← ممنوع (403)
 */
export function requireAdminToken(request: NextRequest): NextResponse | null {
  const expected = process.env.RAKSHTAK_ADMIN_TOKEN || "";
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "الإدارة مقفولة: RAKSHTAK_ADMIN_TOKEN غير مضبوط على الخادم (أضفه في Vercel ثم أعد النشر).",
      },
      { status: 403 }
    );
  }

  const bearer = request.headers.get("authorization") || "";
  const provided =
    request.headers.get(ADMIN_TOKEN_HEADER) ||
    (bearer.startsWith("Bearer ") ? bearer.slice(7) : "") ||
    "";

  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      {
        error: "غير مصرح: أضف ترويسة x-admin-token بقيمة RAKSHTAK_ADMIN_TOKEN الصحيحة.",
      },
      { status: 403 }
    );
  }

  return null;
}
