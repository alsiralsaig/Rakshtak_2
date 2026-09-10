import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminToken } from "@/lib/admin";

export async function PATCH(request: NextRequest) {
  // البوابة الإدارية أولاً — تعديل بيانات المستخدمين ليس مفتوحاً للعامة
  const denied = requireAdminToken(request);
  if (denied) return denied;

  try {
    const { userId, bankAccount } = await request.json();
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      return NextResponse.json(
        { error: "معرّف مستخدم غير صالح" },
        { status: 400 }
      );
    }

    const cleanBankAccount =
      bankAccount === undefined || bankAccount === null || bankAccount === ""
        ? null
        : String(bankAccount).trim().slice(0, 50);

    const [updated] = await db
      .update(users)
      .set({ bankAccount: cleanBankAccount })
      .where(eq(users.id, numericUserId))
      .returning({ id: users.id });

    if (!updated) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    // لا نُعيد رقم الحساب في الاستجابة إطلاقاً
    return NextResponse.json({ message: "تم تحديث بيانات المستخدم" });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}
