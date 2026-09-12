import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signDriverToken } from "@/lib/driverAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, code, name, bankAccount, vehicleType } = body;

    if (typeof phone !== "string" || !/^\+249[19]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "رقم هاتف غير صحيح" },
        { status: 400 }
      );
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: "رمز التحقق يجب أن يكون 6 أرقام" },
        { status: 400 }
      );
    }

    // البحث عن الرمز الصحيح في otp_codes
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (otpError || !otpData) {
      return NextResponse.json(
        { ok: false, error: "رمز التحقق غير صحيح أو منتهي الصلاحية" },
        { status: 401 }
      );
    }

    // وضع علامة على الرمز أنه استُخدم
    await supabase
      .from("otp_codes")
      .update({ consumed: true })
      .eq("id", otpData.id);

    // البحث أو إنشاء السائق
    const { data: existingDriver } = await supabase
      .from("drivers")
      .select("*")
      .eq("phone", phone)
      .single();

    let driver;
    if (existingDriver) {
      // تحديث البيانات الموجودة
      const updates: any = {};
      if (name) updates.name = name.trim().slice(0, 50);
      if (bankAccount) updates.bank_account = bankAccount.trim().slice(0, 50);
      if (vehicleType) updates.vehicle_type = vehicleType.trim().slice(0, 30);

      const { data: updated } = await supabase
        .from("drivers")
        .update(updates)
        .eq("id", existingDriver.id)
        .select()
        .single();
      driver = updated;
    } else {
      // إنشاء سائق جديد
      const { data: newDriver } = await supabase
        .from("drivers")
        .insert({
          phone,
          name: typeof name === "string" ? name.trim().slice(0, 50) : "",
          bank_account:
            typeof bankAccount === "string"
              ? bankAccount.trim().slice(0, 50)
              : null,
          vehicle_type:
            typeof vehicleType === "string"
              ? vehicleType.trim().slice(0, 30)
              : null,
          is_online: true,
        })
        .select()
        .single();
      driver = newDriver;
    }

    const token = signDriverToken(driver.id);

    return NextResponse.json({
      ok: true,
      token,
      driver: {
        id: driver.id,
        phone: driver.phone,
        name: driver.name,
        bankAccount: driver.bank_account,
        vehicleType: driver.vehicle_type,
        isOnline: driver.is_online,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json(
      { ok: false, error: "تعذر التحقق من الرمز" },
      { status: 500 }
    );
  }
}
