import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, driverOtps } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { signDriverToken } from "@/lib/driverAuth";

// ===== POST: التحقق من رمز OTP وتسجيل دخول السائق (أو إنشاء حساب جديد) =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, code, name, bankAccount, vehicleType } = body;

    if (typeof phone !== "string" || !/^\+249[19]\d{8}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "رقم هاتف غير صحيح" }, { status: 400 });
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "رمز التحقق يجب أن يكون 6 أرقام" }, { status: 400 });
    }

    const [otpRow] = await db
      .select()
      .from(driverOtps)
      .where(
        and(
          eq(driverOtps.phone, phone),
          eq(driverOtps.code, code),
          eq(driverOtps.consumed, false),
          gt(driverOtps.expiresAt, new Date())
        )
      );

    if (!otpRow) {
      return NextResponse.json(
        { ok: false, error: "رمز التحقق غير صحيح أو منتهي الصلاحية" },
        { status: 401 }
      );
    }

    await db.update(driverOtps).set({ consumed: true }).where(eq(driverOtps.id, otpRow.id));

    let [driver] = await db.select().from(drivers).where(eq(drivers.phone, phone));

    if (!driver) {
      const [created] = await db
        .insert(drivers)
        .values({
          phone,
          name: typeof name === "string" ? name.trim().slice(0, 50) : "",
          bankAccount: typeof bankAccount === "string" ? bankAccount.trim().slice(0, 50) : null,
          vehicleType: typeof vehicleType === "string" ? vehicleType.trim().slice(0, 30) : null,
          isOnline: true,
        })
        .returning();
      driver = created;
    } else {
      const updates: Record<string, unknown> = {};
      if (typeof name === "string" && name.trim()) updates.name = name.trim().slice(0, 50);
      if (typeof bankAccount === "string" && bankAccount.trim())
        updates.bankAccount = bankAccount.trim().slice(0, 50);
      if (typeof vehicleType === "string" && vehicleType.trim())
        updates.vehicleType = vehicleType.trim().slice(0, 30);

      if (Object.keys(updates).length > 0) {
        const [updated] = await db
          .update(drivers)
          .set(updates)
          .where(eq(drivers.id, driver.id))
          .returning();
        driver = updated;
      }
    }

    const token = signDriverToken(driver.id);

    return NextResponse.json({
      ok: true,
      token,
      driver: {
        id: driver.id,
        phone: driver.phone,
        name: driver.name,
        bankAccount: driver.bankAccount,
        vehicleType: driver.vehicleType,
        isOnline: driver.isOnline,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying OTP:", error);
    return NextResponse.json({ ok: false, error: "تعذر التحقق من الرمز" }, { status: 500 });
  }
}
