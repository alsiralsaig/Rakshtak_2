import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rides, users, ratings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAdminToken } from "@/lib/admin";

/** الحالات المسموح نقل الرحلة إليها عبر هذه المسارات (النظام القديم) */
const ALLOWED_STATUSES = ["searching", "accepted", "arrived", "completed", "cancelled"];

/** قيم التقييم المسموحة (1–5) */
function normalizeRating(value: unknown): number | null {
  const n = Number(value);
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error("التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5");
  }
  return n;
}

function normalizeLatLng(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} يجب أن يكون رقماً صحيحاً`);
  }
  return n;
}

/** دالة تحديث متوسط التقييم (تتعامل بأمان مع القيم الفارغة) */
async function updateUserAvgRating(userId: number) {
  const result = await db
    .select({ avg: sql<number>`AVG(rating)`, count: sql<number>`COUNT(*)` })
    .from(ratings)
    .where(eq(ratings.toUserId, userId));

  const avg = result[0]?.avg || 0;
  const count = result[0]?.count || 0;

  await db
    .update(users)
    .set({ avgRating: avg, totalRatings: count })
    .where(eq(users.id, userId));
}

/** دالة إرسال إشعار فوري عبر Pusher */
const sendPusherEvent = async (rideId: number, status: string) => {
  try {
    const Pusher = (await import("pusher")).default;
    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
    await pusher.trigger(`ride-${rideId}`, "status-update", { status });
    console.log(`📡 إشعار فوري أُرسل للرحلة ${rideId}: ${status}`);
  } catch (e) {
    console.warn("⚠️ Pusher غير مضبوط، لن نستخدم التحديث الفوري.");
  }
};

/** تحويل driverId (نص/رقم) إلى معرّف مستخدم صحيح — يرجع null إن لم يكن صالحاً */
function toUserId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ===== GET: جلب رحلة محددة (لرابط التتبع العام — بدون بيانات حساسة) =====
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rideId = parseInt(id, 10);
    if (!Number.isInteger(rideId)) {
      return NextResponse.json({ error: "معرّف رحلة غير صالح" }, { status: 400 });
    }

    // أعمدة آمنة فقط: ❌ بلا customerPhone ولا customerName ولا bankAccount
    const [ride] = await db
      .select({
        id: rides.id,
        serviceType: rides.serviceType,
        pickupLocation: rides.pickupLocation,
        destination: rides.destination,
        status: rides.status,
        driverId: rides.driverId,
        driverLat: rides.driverLat,
        driverLng: rides.driverLng,
        createdAt: rides.createdAt,
      })
      .from(rides)
      .where(eq(rides.id, rideId));

    if (!ride) {
      return NextResponse.json({ error: "الرحلة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json(ride);
  } catch (error) {
    console.error("Error fetching ride:", error);
    return NextResponse.json({ error: "فشل الجلب" }, { status: 500 });
  }
}

// ===== PATCH: تحديث الرحلة (قبول، إلغاء، تقييم) =====
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // البوابة الإدارية أولاً
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const rideId = parseInt(id, 10);
    if (!Number.isInteger(rideId)) {
      return NextResponse.json({ error: "معرّف رحلة غير صالح" }, { status: 400 });
    }

    const body = await request.json();
    const {
      status,
      driverId,
      driverLat,
      driverLng,
      driverRating,
      riderRating,
      ratingComment,
    } = body;

    // 1) بناء التحديث جزئياً: الحقول المرسلة فقط تُعدَّل،
    //    وأي حقل غير مرسل يبقى كما هو (لا مسح للحقول غير المرسلة!)
    const updates: Record<string, unknown> = {};

    if (status !== undefined) {
      if (typeof status !== "string" || !ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            error: `الحالة غير مسموحة. الحالات الصالحة: ${ALLOWED_STATUSES.join("، ")}`,
          },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (driverId !== undefined) {
      // يسمح بإسناد سائق (نص/رقم) أو فك الإسناد بـ null صريح — أما الغياب فيعني "لا تغيير"
      const cleanDriverId =
        driverId === null || driverId === "" ? null : String(driverId).slice(0, 20);
      updates.driverId = cleanDriverId;
    }

    if (driverLat !== undefined) {
      const lat = normalizeLatLng(driverLat, "خط العرض");
      updates.driverLat = lat;
    }

    if (driverLng !== undefined) {
      const lng = normalizeLatLng(driverLng, "خط الطول");
      updates.driverLng = lng;
    }

    if (driverRating !== undefined) {
      updates.driverRating = normalizeRating(driverRating);
    }

    if (riderRating !== undefined) {
      updates.riderRating = normalizeRating(riderRating);
    }

    if (ratingComment !== undefined) {
      updates.ratingComment =
        ratingComment === null ? null : String(ratingComment).slice(0, 500);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "لا توجد حقول قابلة للتحديث في الطلب" },
        { status: 400 }
      );
    }

    const previousStatus =
      status !== undefined
        ? (
            await db
              .select({ status: rides.status })
              .from(rides)
              .where(eq(rides.id, rideId))
          )[0]?.status
        : undefined;

    // 2) التحديث الفعلي
    await db.update(rides).set(updates).where(eq(rides.id, rideId));

    // 3) إشعار Pusher عند تغيّر الحالة فقط
    if (status !== undefined && previousStatus && previousStatus !== status) {
      await sendPusherEvent(rideId, status);
    }

    // 4) تسجيل التقييمات عند الإكمال — مرة واحدة فقط لكل جهة (بلا تكرار)
    if (status === "completed" && previousStatus !== "completed") {
      const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));

      if (!ride) {
        return NextResponse.json({ error: "الرحلة غير موجودة" }, { status: 404 });
      }

      const driverUserId = toUserId(ride.driverId);

      // تقييم السائق من الراكب (driverRating أُرسل من جهة الراكب)
      if (driverRating !== undefined && driverRating !== null) {
        const fromUserId = ride.userId;
        if (fromUserId && driverUserId) {
          const existing = await db
            .select({ id: ratings.id })
            .from(ratings)
            .where(
              and(
                eq(ratings.rideId, ride.id),
                eq(ratings.fromUserId, fromUserId),
                eq(ratings.toUserId, driverUserId)
              )
            )
            .limit(1);

          // driverRating محقَّق أعلاه أنه ليس null/undefined — والقيمة صحيحة 1..5 أو رمى خطأ
          const rating = normalizeRating(driverRating) as number;
          if (existing[0]) {
            await db
              .update(ratings)
              .set({ rating, comment: ratingComment || "" })
              .where(eq(ratings.id, existing[0].id));
          } else {
            await db.insert(ratings).values({
              rideId: ride.id,
              fromUserId,
              toUserId: driverUserId,
              rating,
              comment: ratingComment || "",
            });
          }
          await updateUserAvgRating(driverUserId);
        }
      }

      // تقييم الراكب من السائق (riderRating أُرسل من جهة السائق)
      if (riderRating !== undefined && riderRating !== null) {
        const fromDriverId = driverUserId;
        const toRiderId = ride.userId;
        if (fromDriverId && toRiderId) {
          const existing = await db
            .select({ id: ratings.id })
            .from(ratings)
            .where(
              and(
                eq(ratings.rideId, ride.id),
                eq(ratings.fromUserId, fromDriverId),
                eq(ratings.toUserId, toRiderId)
              )
            )
            .limit(1);

          // riderRating محقَّق أعلاه أنه ليس null/undefined
          const rating = normalizeRating(riderRating) as number;
          if (existing[0]) {
            await db
              .update(ratings)
              .set({ rating, comment: "" })
              .where(eq(ratings.id, existing[0].id));
          } else {
            await db.insert(ratings).values({
              rideId: ride.id,
              fromUserId: fromDriverId,
              toUserId: toRiderId,
              rating,
              comment: "",
            });
          }
          await updateUserAvgRating(toRiderId);
        }
      }
    }

    return NextResponse.json({ message: "تم تحديث الرحلة بنجاح" });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("التقييم")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating ride:", error);
    return NextResponse.json({ error: "فشل تحديث الرحلة" }, { status: 500 });
  }
}
