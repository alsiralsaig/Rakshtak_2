import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rides, users, ratings } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { requireAdminToken } from "@/lib/admin";

export async function GET(request: NextRequest) {
  // البوابة الإدارية أولاً — الإحصائيات سرّ إداري
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    // 1. إجمالي الرحلات
    const totalRides = await db.select({ count: count() }).from(rides);

    // 2. عدد السائقين (role = "driver")
    const totalDrivers = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "driver"));

    // 3. عدد الركاب (role = "rider")
    const totalRiders = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "rider"));

    // 4. متوسط التقييم الكلي
    const avgRatingResult = await db
      .select({ avg: sql<number>`AVG(rating)` })
      .from(ratings);

    // 5. الرحلات النشطة (searching)
    const activeRides = await db
      .select({ count: count() })
      .from(rides)
      .where(eq(rides.status, "searching"));

    // 6. الرحلات الملغاة (cancelled)
    const cancelledRides = await db
      .select({ count: count() })
      .from(rides)
      .where(eq(rides.status, "cancelled"));

    // 7. آخر 10 رحلات — بأعمدة آمنة فقط (بلا customerPhone/bankAccount)
    const recentRides = await db
      .select({
        id: rides.id,
        serviceType: rides.serviceType,
        pickupLocation: rides.pickupLocation,
        destination: rides.destination,
        status: rides.status,
        driverId: rides.driverId,
        createdAt: rides.createdAt,
      })
      .from(rides)
      .orderBy(sql`created_at DESC`)
      .limit(10);

    return NextResponse.json({
      totalRides: totalRides[0]?.count || 0,
      totalDrivers: totalDrivers[0]?.count || 0,
      totalRiders: totalRiders[0]?.count || 0,
      averageRating: Math.round((avgRatingResult[0]?.avg || 0) * 10) / 10,
      activeRides: activeRides[0]?.count || 0,
      cancelledRides: cancelledRides[0]?.count || 0,
      recentRides: recentRides || [],
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "فشل جلب الإحصائيات" },
      { status: 500 }
    );
  }
}

