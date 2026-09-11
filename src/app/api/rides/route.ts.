export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createRide, validateCreateRide } from "@/lib/rideServer";

/**
 * POST /api/rides — إنشاء طلب رحلة (عام، بعد تحقق كامل من المدخلات)
 * يرجع: { ride, riderToken } — riderToken يُحفظ في localStorage عند الراكب
 * ويُرسل في ترويسة x-rider-token لكل تعديل لاحق على رحلته.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "طلب غير صالح" }, { status: 400 });
  }

  const result = validateCreateRide(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  try {
    const { ride, riderToken } = await createRide(result.input);
    return NextResponse.json({ ok: true, ride, riderToken }, { status: 201 });
  } catch (err) {
    console.error("create ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "تعذر حفظ الطلب — تحقق من إعدادات قاعدة البيانات على الخادم",
      },
      { status: 503 }
    );
  }
}
