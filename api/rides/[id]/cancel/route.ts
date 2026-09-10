import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rides } from "@/db/schema";
import { eq } from "drizzle-orm";

// ===== POST: إلغاء رحلة (يتطلب x-rider-token مطابق، والحالة pending أو accepted فقط) =====
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rideId = Number(params.id);
    if (!Number.isInteger(rideId)) {
      return NextResponse.json({ ok: false, error: "معرّف رحلة غير صحيح" }, { status: 400 });
    }

    const riderToken = request.headers.get("x-rider-token") || "";
    if (!riderToken) {
      return NextResponse.json({ ok: false, error: "رمز الراكب مطلوب" }, { status: 403 });
    }

    const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));

    if (!ride) {
      return NextResponse.json({ ok: false, error: "الرحلة غير موجودة" }, { status: 404 });
    }
    if (ride.riderToken !== riderToken) {
      return NextResponse.json({ ok: false, error: "غير مصرح بإلغاء هذه الرحلة" }, { status: 403 });
    }
    if (ride.status !== "pending" && ride.status !== "accepted") {
      return NextResponse.json(
        { ok: false, error: "لا يمكن إلغاء رحلة مكتملة أو ملغاة بالفعل" },
        { status: 409 }
      );
    }

    await db.update(rides).set({ status: "cancelled" }).where(eq(rides.id, rideId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ Error cancelling ride:", error);
    return NextResponse.json({ ok: false, error: "حدث خطأ أثناء إلغاء الرحلة" }, { status: 500 });
  }
}
