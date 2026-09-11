export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * DELETE /api/admin/rides/[id] — حذف رحلة (الإدارة فقط)
 */
export async function DELETE(
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
    const { error, count } = await admin.from("rides").delete().eq("id", rideId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "فشل الحذف: " + error.message },
        { status: 500 }
      );
    }
    if (!count) {
      return NextResponse.json({ ok: false, error: "الرحلة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin delete ride error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل الحذف",
      },
      { status: 503 }
    );
  }
}
