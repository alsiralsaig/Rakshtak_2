import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminToken } from "@/lib/admin";

/** قائمة الخدمات المسموحة (قيم موحدة قصيرة) */
const ALLOWED_SERVICE_TYPES = ["ride", "goods", "ركشة ركاب", "توك توك بضائع", "تكسي"];

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

// ===== POST: إنشاء طلب رحلة جديد =====
export async function POST(request: NextRequest) {
  // البوابة الإدارية أولاً — بدون الرمز لا يُكتب ولا يُقرأ أي شيء
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { serviceType, pickupLocation, destination, userId, customerName } = body;

    if (!serviceType || !pickupLocation || !destination) {
      return NextResponse.json(
        { error: "بيانات ناقصة (الخدمة، نقطة الانطلاق، والوجهة مطلوبة)" },
        { status: 400 }
      );
    }

    const cleanService = cleanText(serviceType, "الخدمة", 20);
    if (!ALLOWED_SERVICE_TYPES.includes(cleanService)) {
      return NextResponse.json(
        { error: "نوع الخدمة غير مسموح به" },
        { status: 400 }
      );
    }

    const cleanPickup = cleanText(pickupLocation, "نقطة الانطلاق");
    const cleanDestination = cleanText(destination, "الوجهة");
    const cleanName = customerName ? cleanText(customerName, "اسم العميل", 50) : null;

    // إدراج الرحلة في قاعدة البيانات (بدون أي حقول حساسة من المتصل)
    const [newRide] = await db
      .insert(rides)
      .values({
        serviceType: cleanService,
        pickupLocation: cleanPickup,
        destination: cleanDestination,
        userId:
          userId === undefined || userId === null
            ? null
            : Number.isInteger(Number(userId))
              ? Number(userId)
              : null,
        customerName: cleanName,
        status: "searching", // الحالة الافتراضية
      })
      .returning({
        id: rides.id,
        serviceType: rides.serviceType,
        pickupLocation: rides.pickupLocation,
        destination: rides.destination,
        status: rides.status,
        createdAt: rides.createdAt,
      });

    return NextResponse.json({ ride: newRide }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("الحقل")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("❌ Error creating ride:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حفظ الطلب" },
      { status: 500 }
    );
  }
}

// ===== GET: جلب الطلبات (إداري فقط — بدون أي بيانات حساسة) =====
export async function GET(request: NextRequest) {
  // البوابة الإدارية أولاً
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // اختيار أعمدة آمنة فقط:
    // ❌ customerPhone / bankAccount / customerName لم تعُد تُرجَع إطلاقاً
    const safeColumns = {
      id: rides.id,
      serviceType: rides.serviceType,
      pickupLocation: rides.pickupLocation,
      destination: rides.destination,
      status: rides.status,
      driverId: rides.driverId,
      driverLat: rides.driverLat,
      driverLng: rides.driverLng,
      createdAt: rides.createdAt,
    };

    // تصفية حسب الحالة إذا وُجدت
    const results = status
      ? await db.select(safeColumns).from(rides).where(eq(rides.status, status))
      : await db.select(safeColumns).from(rides);

    return NextResponse.json(results);
  } catch (error) {
    console.error("❌ Error fetching rides:", error);
    return NextResponse.json(
      { error: "فشل جلب الطلبات" },
      { status: 500 }
    );
  }
}
