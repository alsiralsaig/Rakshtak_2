import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rides } from "@/db/schema";
import { eq } from "drizzle-orm";

const PRICE_RAISE_RATIO = 0.2;

// ===== POST: رفع السعر المقترح 20% (يتطلب x-rider-token مطابق، والحالة pending فقط) =====
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
      return NextResponse.json({ ok: false, error: "غير مصرح بتعديل هذه الرحلة" }, { status: 403 });
    }
    if (ride.status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "لا يمكن رفع السعر إلا أثناء البحث عن سائق" },
        { status: 409 }
      );
    }

    const basePrice = ride.offeredPrice && ride.offeredPrice > 0 ? ride.offeredPrice : 1000;
    const newPrice = Math.round(basePrice * (1 + PRICE_RAISE_RATIO));

    await db.update(rides).set({ offeredPrice: newPrice }).where(eq(rides.id, rideId));

    return NextResponse.json({ ok: true, price: newPrice });
  } catch (error) {
    console.error("❌ Error raising price:", error);
    return NextResponse.json({ ok: false, error: "حدث خطأ أثناء رفع السعر" }, { status: 500 });
  }
}
