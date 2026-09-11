export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { acceptRide } from "@/lib/rideServer";
import { findDriverByToken, getDriverToken } from "@/lib/driverSession";

/**
 * POST /api/rides/[id]/accept — قبول السائق لرحلة (x-driver-token)
 * التحديث شرطي على status=pending فيمنع القبول المزدوج (التنافس: 409).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rideId = Number(id);
    if (!Number.isInteger(rideId) || rideId <= 0) {
      return NextResponse.json({ ok: false, error: "معرّف رحلة غير صالح" }, { status: 400 });
    }

    const driver = await findDriverByToken(getDriverToken(request));
    if (!driver) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير صالحة — سجّل الدخول من جديد" },
        { status: 401 }
      );
    }

    const result = await acceptRide(rideId, driver.id, driver.phone);
    if (!result.ok) {
      if (result.conflict) {
        return NextResponse.json(
          { ok: false, error: "الطلب اتقبل من سائق تاني قبل ما تدوس — جرب طلب تاني" },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ride: result.ride });
  } catch (err) {
    console.error("accept ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل القبول",
      },
      { status: 503 }
    );
  }
}
