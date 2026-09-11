export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getRiderToken, loadRide, riderTokenMatches, toSafeRide } from "@/lib/rideServer";

/**
 * GET /api/rides/[id] — استطلاع حالة الرحلة (صاحبها فقط عبر x-rider-token)
 * بعد تفعيل RLS في المرحلة 3 يعتمد الراكب على هذا الاستطلاع الدوري.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rideId = Number(id);
    if (!Number.isInteger(rideId) || rideId <= 0) {
      return NextResponse.json({ ok: false, error: "معرّف رحلة غير صالح" }, { status: 400 });
    }

    const token = getRiderToken(request);
    if (!token) {
      return NextResponse.json({ ok: false, error: "رمز الرحلة مطلوب" }, { status: 401 });
    }

    const row = await loadRide(rideId);
    if (!row) {
      return NextResponse.json({ ok: false, error: "الرحلة غير موجودة" }, { status: 404 });
    }
    if (!riderTokenMatches(String(row.rider_token || ""), token)) {
      return NextResponse.json({ ok: false, error: "غير مصرح بهذه الرحلة" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, ride: toSafeRide(row) });
  } catch (err) {
    console.error("poll ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "خدمة الاستعلام غير مضبوطة على الخادم بعد",
      },
      { status: 503 }
    );
  }
}
