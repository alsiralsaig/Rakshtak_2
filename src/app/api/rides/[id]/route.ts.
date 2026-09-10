import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rides } from "@/db/schema";
import { randomBytes } from "crypto";

/** أنواع الخدمة المسموحة (يجب أن تطابق SERVICE_TYPES في src/lib/constants.ts) */
const ALLOWED_SERVICE_TYPES = ["ركشة ركاب", "تكسي", "توصيل طرود"];

const MAX_STRING = 300;

/** تنظيف النصوص ومنع القيم الطويلة/الفارغة */
function cleanText(value: unknown, label: string, max = MAX_STRING): string {
  if (typeof value !== "string") {
    throw new Error(`الحقل "${label}" مطلوب كنص`);
  }
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`الحقل "${label}" مطلوب`);
  if (cleaned.length > max) {
    throw new Error(`الحقل "${label}" أطول من المسموح (${max} حرفاً)`);
  }
  return cleaned;
}

/** توليد رمز راكب عشوائي آمن لمتابعة/إلغاء/رفع سعر رحلته بدون تسجيل دخول */
function generateRiderToken(): string {
  return randomBytes(24).toString("hex");
}

// ===== POST: إنشاء طلب رحلة جديد (مفتوح لأي راكب — بدون توكن إداري) =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      passengerName,
      phone,
      pickupLocation,
      destination,
      offeredPrice,
      serviceType,
      pickupLat,
      pickupLng,
    } = body;

    const cleanName = cleanText(passengerName, "الاسم", 50);
    const cleanPhone = cleanText(phone, "رقم الهاتف", 20);
    const cleanPickup = cleanText(pickupLocation, "نقطة الانطلاق");
    const cleanDestination = cleanText(destination, "الوجهة");
    const cleanService = cleanText(serviceType, "نوع الخدمة", 30);

    if (!ALLOWED_SERVICE_TYPES.includes(cleanService)) {
      return NextResponse.json(
        { ok: false, error: "نوع الخدمة غير مسموح به" },
        { status: 400 }
      );
    }

    let cleanPrice: number | null = null;
    if (offeredPrice !== null && offeredPrice !== undefined && offeredPrice !== "") {
      const n = Number(offeredPrice);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { ok: false, error: "السعر المقترح غير صحيح" },
          { status: 400 }
        );
      }
      cleanPrice = Math.round(n);
    }

    const riderToken = generateRiderToken();

    const [newRide] = await db
      .insert(rides)
      .values({
        passengerName: cleanName,
        phoneNumber: cleanPhone,
        serviceType: cleanService,
        pickupLocation: cleanPickup,
        destination: cleanDestination,
        pickupLat: typeof pickupLat === "number" ? pickupLat : null,
        pickupLng: typeof pickupLng === "number" ? pickupLng : null,
        offeredPrice: cleanPrice,
        status: "pending",
        riderToken,
      })
      .returning();

    return NextResponse.json(
      {
        ok: true,
        riderToken,
        ride: {
          id: newRide.id,
          status: newRide.status,
          serviceType: newRide.serviceType,
          pickupLocation: newRide.pickupLocation,
          destination: newRide.destination,
          offeredPrice: newRide.offeredPrice,
          driverId: newRide.driverId,
          driverPhone: newRide.driverPhone,
          createdAt: newRide.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("الحقل")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("❌ Error creating ride:", error);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ أثناء حفظ الطلب" },
      { status: 500 }
    );
  }
}
