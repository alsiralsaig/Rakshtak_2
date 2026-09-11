export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { cancelRide, getRiderToken } from "@/lib/rideServer";
import { findDriverByToken, getDriverToken } from "@/lib/driverSession";
import { requireAdminToken } from "@/lib/admin";

/**
 * POST /api/rides/[id]/cancel — إلغاء الرحلة:
 * • صاحبها (x-rider-token) • السائق المعيّن عليها (x-driver-token) • الإدارة (x-admin-token)
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

    const adminDenied = requireAdminToken(request);
    if (adminDenied) {
      // ليست إدارة؟ جرّب الراكب ثم السائق
      const riderToken = getRiderToken(request);
      let driverAuth: { id: number; phone: string } | null = null;
      try {
        const driver = await findDriverByToken(getDriverToken(request));
        if (driver) driverAuth = { id: driver.id, phone: driver.phone };
      } catch {
        driverAuth = null;
      }

      if (!riderToken && !driverAuth) {
        return NextResponse.json(
          { ok: false, error: "غير مصرح — أرسل رمز الراكب أو السائق أو الإدارة" },
          { status: 401 }
        );
      }

      const result = await cancelRide(rideId, {
        riderToken: riderToken || undefined,
        driverId: driverAuth?.id,
        driverPhone: driverAuth?.phone,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
      }
      return NextResponse.json({ ok: true });
    }

    // إدارة: adminDenied === null يعني أن الرمز الإداري صحيح
    const result = await cancelRide(rideId, { admin: true });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cancel ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل الإلغاء",
      },
      { status: 503 }
    );
  }
}
