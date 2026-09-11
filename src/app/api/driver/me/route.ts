export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { findDriverByToken, getDriverToken, serializeDriver } from "@/lib/driverSession";

/**
 * GET /api/driver/me
 * استعادة جلسة السائق (تُستدعى عند فتح لوحة السائق لتفادي إعادة إرسال OTP)
 */
export async function GET(request: NextRequest) {
  try {
    const driver = await findDriverByToken(getDriverToken(request));
    if (!driver) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير صالحة — سجّل الدخول من جديد" },
        { status: 401 }
      );
    }
    return NextResponse.json({ ok: true, driver: serializeDriver(driver) });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "خدمة الجلسات غير مضبوطة على الخادم بعد",
      },
      { status: 503 }
    );
  }
}
