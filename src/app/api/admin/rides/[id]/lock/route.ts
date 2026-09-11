export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/admin/rides/[id]/lock — إعادة فتح رحلة «عالقة»:
 * مشوار accepted بدون سائق فعلي أو قفل بعد إلغاء من جانب السائق؟
 * يرجّعها pending (تُحذف بيانات السائق) لتظهر مجدداً للطلبات المتاحة.
 * الإدارة فقط.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const rideId = Number(id);
    if (!Number.isInteger(rideId) || rideId <= 0) {
      return NextResponse.json({ ok: false, error: "معرّف رحلة غير صالح" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // من accepted فقط — حتى لا نعيد فتح رحلة مكتملة أو ملغاة
    const { data, error } = await admin
      .from("rides")
      .update({ status: "pending", driver_id: null, driver_phone: null })
      .eq("id", rideId)
      .eq("status", "accepted")
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "فشل إعادة الفتح: " + error.message },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "الرحلة ليست قيد التنفيذ — لا يمكن إعادة فتحها" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin unlock ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل إعادة فتح الرحلة",
      },
      { status: 503 }
    );
  }
}
