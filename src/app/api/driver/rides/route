export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { findDriverByToken, getDriverToken } from "@/lib/driverSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { toDriverRide } from "@/lib/rideServer";
import { haversineKm, radiusBounds, DEFAULT_SEARCH_RADIUS_KM } from "@/lib/geo";

/**
 * GET /api/driver/rides?lat=..&lng=.. — قائمة طلبات السائق:
 * • الطلبات pending الأقرب (داخل ±10 كم حول موقع السائق) مرتبة بالمسافة
 * • الطلبات بلا إحداثيات تظهر في النهاية (لا تضيع)
 * • المشوار الحالي «مشواري أنا» عبر driver_id (مع دعم driver_phone القديم)
 * الموقع: إما query params (من GPS المتصفح) أو current_lat/lng المخزّنة.
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

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const qLat = Number(searchParams.get("lat"));
    const qLng = Number(searchParams.get("lng"));
    const hasLive =
      Number.isFinite(qLat) && Number.isFinite(qLng) && qLat !== 0 && qLng !== 0;

    let lat = hasLive ? qLat : driver.current_lat === null || driver.current_lat === undefined ? NaN : Number(driver.current_lat);
    let lng = hasLive ? qLng : driver.current_lng === null || driver.current_lng === undefined ? NaN : Number(driver.current_lng);
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    if (!hasLocation) {
      lat = 0;
      lng = 0;
    }

    // ── الطلبات المتاحة ──────────────────────────────────────────
    let available: Record<string, unknown>[] = [];

    if (hasLocation) {
      const b = radiusBounds(lat, lng, DEFAULT_SEARCH_RADIUS_KM);
      const { data: inBbox, error: bboxError } = await admin
        .from("rides")
        .select("*")
        .eq("status", "pending")
        .gte("pickup_lat", b.minLat)
        .lte("pickup_lat", b.maxLat)
        .gte("pickup_lng", b.minLng)
        .lte("pickup_lng", b.maxLng);

      const { data: noCoords } = await admin
        .from("rides")
        .select("*")
        .eq("status", "pending")
        .is("pickup_lat", null);

      if (bboxError) {
        return NextResponse.json(
          { ok: false, error: "فشل جلب الطلبات: " + bboxError.message },
          { status: 500 }
        );
      }

      const near = (inBbox || [])
        .filter(
          (r: any) =>
            typeof r.pickup_lat === "number" && typeof r.pickup_lng === "number"
        )
        .map((r: any) => ({
          row: r as Record<string, unknown>,
          d: haversineKm(lat, lng, r.pickup_lat as number, r.pickup_lng as number),
        }))
        .sort((a, b2) => a.d - b2.d);

      available = [
        ...near.map((n) => toDriverRide(n.row, Math.round(n.d * 10) / 10)),
        ...((noCoords || []) as Record<string, unknown>[]).map((r) => toDriverRide(r, null)),
      ];
    } else {
      const { data } = await admin
        .from("rides")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      available = ((data || []) as Record<string, unknown>[]).map((r) => toDriverRide(r, null));
    }

    // ── المشوار الحالي: مشواري أنا فقط ───────────────────────────
    let mine: Record<string, unknown> | null = null;
    const { data: byId } = await admin
      .from("rides")
      .select("*")
      .eq("status", "accepted")
      .eq("driver_id", driver.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byId) {
      mine = byId as Record<string, unknown>;
    } else {
      const { data: byPhone } = await admin
        .from("rides")
        .select("*")
        .eq("status", "accepted")
        .eq("driver_phone", driver.phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byPhone) mine = byPhone as Record<string, unknown>;
    }

    return NextResponse.json({
      ok: true,
      hasLocation,
      available,
      current: mine ? toDriverRide(mine as Record<string, unknown>) : null,
    });
  } catch (err) {
    console.error("driver rides error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "خدمة الطلبات غير مضبوطة بعد",
      },
      { status: 503 }
    );
  }
}
