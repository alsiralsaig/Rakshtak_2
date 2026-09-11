export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { findDriverByToken, getDriverToken } from "@/lib/driverSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/driver/location { lat, lng } — تحديث موقع السائق الحالي
 * (يُخزَّن في drivers.current_lat/lng ويُستخدم عند جلب الطلبات الأقرب)
 */
export async function POST(request: NextRequest) {
  try {
    const driver = await findDriverByToken(getDriverToken(request));
    if (!driver) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير صالحة — سجّل الدخول من جديد" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ ok: false, error: "إحداثيات غير صالحة" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("drivers")
      .update({ current_lat: lat, current_lng: lng })
      .eq("id", driver.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "فشل حفظ الموقع: " + error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "خدمة الموقع غير مضبوطة بعد",
      },
      { status: 503 }
    );
  }
}
