export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  findDriverByToken,
  getDriverToken,
  serializeDriver,
} from "@/lib/driverSession";

/**
 * PATCH /api/driver/profile
 * تحديث بيانات السائق (الاسم/الحساب البنكي/المركبة/حالة التواجد)
 * — يتطلب ترويسة x-driver-token صالحة.
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = getDriverToken(request);
    const driver = await findDriverByToken(token);
    if (!driver) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير صالحة — سجّل الدخول من جديد" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (v) updates.name = v.slice(0, 50);
    }
    if (body.bankAccount !== undefined) {
      const v = String(body.bankAccount).replace(/\s+/g, "").slice(0, 50);
      updates.bank_account = v || null;
    }
    if (body.vehicleType !== undefined) {
      const v = String(body.vehicleType).trim();
      updates.vehicle_type = v ? v.slice(0, 50) : null;
    }
    if (body.licenseNumber !== undefined) {
      const v = String(body.licenseNumber).trim();
      if (v) updates.license_number = v.slice(0, 40);
    }
    if (body.isOnline !== undefined && typeof body.isOnline === "boolean") {
      updates.is_online = body.isOnline;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "لا توجد حقول قابلة للتحديث" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("drivers")
      .update(updates)
      .eq("id", driver.id)
      .select("id, phone, name, bank_account, vehicle_type, license_number, is_online")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "فشل حفظ البيانات: " + (error?.message || "خطأ") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      driver: serializeDriver(data),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "خدمة التحديث غير مضبوطة على الخادم بعد",
      },
      { status: 503 }
    );
  }
}
