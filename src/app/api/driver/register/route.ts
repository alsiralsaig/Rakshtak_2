
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { normalizeSudanesePhone } from "@/lib/format";
import { newSessionToken } from "@/lib/otp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/driver/register  { phone, name, licenseNumber, bankAccount?, vehicleType? }
 * تسجيل/دخول سائق مباشر بلا رمز تحقق (OTP) — تبسيطاً لانتشار التطبيق:
 * الاسم ورقم الرخصة إجباريان، رقم الحساب البنكي ونوع المركبة اختياريان.
 * إن كان الرقم مسجلاً من قبل يُحدَّث ويُصدر له رمز جلسة جديد (تسجيل دخول)،
 * وإلا يُنشأ حساب سائق جديد.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, name, licenseNumber, bankAccount, vehicleType } = body as Record<string, unknown>;

    const normalized = normalizeSudanesePhone(typeof phone === "string" ? phone : "");
    if (!normalized) {
      return NextResponse.json(
        { ok: false, error: "رقم الهاتف السوداني غير صحيح (9 أرقام تبدأ بـ 9)" },
        { status: 400 }
      );
    }

    const clean = (v: unknown, max: number): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t ? t.slice(0, max) : null;
    };

    const cleanName = clean(name, 50);
    const cleanLicense = clean(licenseNumber, 40);
    if (!cleanName) {
      return NextResponse.json({ ok: false, error: "الاسم مطلوب" }, { status: 400 });
    }
    if (!cleanLicense) {
      return NextResponse.json({ ok: false, error: "رقم الرخصة مطلوب" }, { status: 400 });
    }

    const cleanBank = clean(bankAccount, 50);
    const cleanVehicle = clean(vehicleType, 50);

    const admin = getSupabaseAdmin();
    const token = newSessionToken();

    const { data: existing } = await admin
      .from("drivers")
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();

    let driverRow: Record<string, unknown> | null = null;

    if (existing) {
      const { data, error } = await admin
        .from("drivers")
        .update({
          auth_token: token,
          name: cleanName,
          license_number: cleanLicense,
          bank_account: cleanBank,
          vehicle_type: cleanVehicle,
          is_online: true,
        })
        .eq("id", existing.id)
        .select("id, phone, name, bank_account, vehicle_type, license_number, is_online")
        .single();
      if (error) {
        return NextResponse.json(
          { ok: false, error: "فشل تحديث بيانات السائق: " + error.message },
          { status: 500 }
        );
      }
      driverRow = data;
    } else {
      const { data, error } = await admin
        .from("drivers")
        .insert({
          phone: normalized,
          name: cleanName,
          license_number: cleanLicense,
          bank_account: cleanBank,
          vehicle_type: cleanVehicle,
          auth_token: token,
          is_online: true,
        })
        .select("id, phone, name, bank_account, vehicle_type, license_number, is_online")
        .single();
      if (error) {
        return NextResponse.json(
          { ok: false, error: "فشل إنشاء حساب السائق: " + error.message },
          { status: 500 }
        );
      }
      driverRow = data;
    }

    if (!driverRow) {
      return NextResponse.json(
        { ok: false, error: "تعذر حفظ بيانات السائق — حاول مرة أخرى" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      driver: {
        id: driverRow.id,
        phone: driverRow.phone,
        name: driverRow.name,
        bankAccount: driverRow.bank_account,
        vehicleType: driverRow.vehicle_type,
        licenseNumber: driverRow.license_number,
        isOnline: driverRow.is_online,
      },
    });
  } catch (err) {
    console.error("driver register error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "خدمة التسجيل غير مضبوطة على الخادم بعد",
      },
      { status: 503 }
    );
  }
}
