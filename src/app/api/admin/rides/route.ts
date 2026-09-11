export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/admin/rides — لوحة الإدارة (x-admin-token)
 * يرجع آخر 100 رحلة + إحصائيات سريعة بالحالات الموحّدة.
 */
export async function GET(request: NextRequest) {
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    const admin = getSupabaseAdmin();

    const { data: rides, error } = await admin
      .from("rides")
      .select("id, passenger_name, phone_number, pickup_location, destination, offered_price, service_type, status, driver_id, driver_phone, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "فشل جلب الرحلات: " + error.message },
        { status: 500 }
      );
    }

    // إحصائيات (مع تطبيع الحالات القديمة)
    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const r of rides || []) {
      total++;
      let s = String(r.status || "pending");
      if (s === "searching") s = "pending";
      if (s === "arrived") s = "accepted";
      if (!["pending", "accepted", "completed", "cancelled"].includes(s)) s = "pending";
      statusMap[s] = (statusMap[s] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      stats: {
        total,
        pending: statusMap.pending || 0,
        accepted: statusMap.accepted || 0,
        completed: statusMap.completed || 0,
        cancelled: statusMap.cancelled || 0,
      },
      rides: rides || [],
    });
  } catch (err) {
    console.error("admin rides error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "خدمة اللوحة غير مضبوطة على الخادم بعد",
      },
      { status: 503 }
    );
  }
}
