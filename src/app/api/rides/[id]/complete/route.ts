export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { completeRide } from "@/lib/rideServer";
import { findDriverByToken, getDriverToken } from "@/lib/driverSession";

/**
 * POST /api/rides/[id]/complete — إنهاء المشوار (السائق المعيّن فقط)
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

    const result = await completeRide(rideId, driver.id, driver.phone);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("complete ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل إنهاء المشوار",
      },
      { status: 503 }
    );
  }
}
