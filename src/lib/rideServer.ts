import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { safeEqual } from "./admin";
import { normalizeSudanesePhone } from "./format";
import { SERVICE_TYPES } from "./constants";

/**
 * عمليات الرحلات على الخادم — المرحلة 3:
 * كل قراءة/كتابة لجدول rides تمر من هنا عبر Service Role (بعد تفعيل RLS
 * أصبح مفتاح anon مقطوعاً تماماً عن الجداول).
 */

export const RIDER_TOKEN_HEADER = "x-rider-token";

/** رمز الراكب: يثبت ملكية الرحلة (يُخزَّن في localStorage عند صاحب الطلب فقط) */
export function generateRiderToken(): string {
  return randomBytes(24).toString("hex");
}

export function riderTokenMatches(rowToken: string | null | undefined, provided: string): boolean {
  return typeof rowToken === "string" && !!rowToken && !!provided && safeEqual(rowToken, provided);
}

/** قراءة رمز راكب من الترويسة */
export function getRiderToken(request: NextRequest): string {
  return (request.headers.get(RIDER_TOKEN_HEADER) || "").trim();
}

/* ── أنواع مدخلات آمنة ─────────────────────────────────────────── */

export interface CreateRideInput {
  passengerName: string;
  phoneNumber: string; // +2499XXXXXXXX
  pickupLocation: string;
  destination: string;
  serviceType: string;
  offeredPrice: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
}

/** تحقق وتنظيف كامل لطلب إنشاء رحلة — يرجع {error} عند الفشل */
export function validateCreateRide(body: Record<string, unknown>): { ok: true; input: CreateRideInput } | { ok: false; error: string } {
  const cleanText = (v: unknown, label: string, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    return t.length > max ? null : t;
  };

  // الاسم اختياري — لو ما اتكتب أو غير صالح نستخدم "راكب" افتراضياً
  const passengerName = cleanText(body.passengerName, "الاسم", 50) || "راكب";
  const pickupLocation = cleanText(body.pickupLocation, "مكان التحرك", 300);
  const destination = cleanText(body.destination, "الوجهة", 300);
  if (!pickupLocation || !destination) {
    return { ok: false, error: "أكمل مكان التحرك والوجهة" };
  }

  const phoneNumber = normalizeSudanesePhone(typeof body.phone === "string" ? body.phone : "");
  if (!phoneNumber) {
    return { ok: false, error: "رقم الهاتف السوداني غير صحيح (9 أرقام تبدأ بـ 9)" };
  }

  const serviceType =
    typeof body.serviceType === "string" && SERVICE_TYPES.some((s) => s.value === body.serviceType)
      ? body.serviceType
      : null;
  if (!serviceType) {
    return { ok: false, error: "نوع الخدمة غير مسموح به" };
  }

  let offeredPrice: number | null = null;
  if (body.offeredPrice !== undefined && body.offeredPrice !== null && body.offeredPrice !== "") {
    const n = Number(body.offeredPrice);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      return { ok: false, error: "السعر المقترح غير صالح" };
    }
    offeredPrice = Math.round(n);
  }

  const num = (v: unknown, min: number, max: number): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return n;
  };
  const pickupLat = num(body.pickupLat, -90, 90);
  const pickupLng = num(body.pickupLng, -180, 180);
  if (body.pickupLat !== undefined && body.pickupLat !== null && pickupLat === null) {
    return { ok: false, error: "إحداثيات مكان التحرك غير صالحة" };
  }

  return {
    ok: true,
    input: { passengerName, phoneNumber, pickupLocation, destination, serviceType, offeredPrice, pickupLat, pickupLng },
  };
}

/* ── تمثيل آمن للصفوف (snake من Supabase → camel للواجهة) ───────── */

export interface SafeRide {
  id: number;
  status: string;
  serviceType: string;
  pickupLocation: string;
  destination: string;
  offeredPrice: number | null;
  driverId: number | null;
  driverPhone: string | null;
  createdAt: string | null;
}

/** تحويل صف rides إلى شكل آمن (بلا rider_token؛ بلا رقم الراكب للراكب نفسه) */
export function toSafeRide(row: Record<string, unknown>): SafeRide {
  return {
    id: Number(row.id),
    status: String(row.status || "pending"),
    serviceType: String(row.service_type || "ركشة ركاب"),
    pickupLocation: String(row.pickup_location || ""),
    destination: String(row.destination || ""),
    offeredPrice: row.offered_price === null || row.offered_price === undefined ? null : Number(row.offered_price),
    driverId: row.driver_id === null || row.driver_id === undefined ? null : Number(row.driver_id),
    driverPhone: row.driver_phone === null || row.driver_phone === undefined ? null : String(row.driver_phone),
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

/** نسخة السائق: تتضمن هاتف الراكب للتواصل */
export function toDriverRide(row: Record<string, unknown>, distanceKm?: number | null) {
  return {
    ...toSafeRide(row),
    passengerName: String(row.passenger_name || ""),
    phoneNumber: String(row.phone_number || ""),
    distanceKm: distanceKm === undefined ? null : distanceKm,
  };
}

/* ── عمليات ─────────────────────────────────────────────────────── */

export interface RideRow extends Record<string, unknown> {}

/** إنشاء رحلة جديدة — يرجع {ride, riderToken} */
export async function createRide(input: CreateRideInput) {
  const admin = getSupabaseAdmin();
  const riderToken = generateRiderToken();

  const { data, error } = await admin
    .from("rides")
    .insert({
      passenger_name: input.passengerName,
      phone_number: input.phoneNumber,
      pickup_location: input.pickupLocation,
      destination: input.destination,
      service_type: input.serviceType,
      offered_price: input.offeredPrice,
      status: "pending",
      pickup_lat: input.pickupLat,
      pickup_lng: input.pickupLng,
      rider_token: riderToken,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("تعذر حفظ الطلب: " + (error?.message || "خطأ غير معروف"));
  }
  return { ride: toSafeRide(data as Record<string, unknown>), riderToken };
}

/** جلب رحلة */
export async function loadRide(rideId: number): Promise<RideRow | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("rides").select("*").eq("id", rideId).maybeSingle();
  return (data as RideRow | null) ?? null;
}

/** إلغاء (لصاحبها بالرمز/لسائقها/للإدارة) */
export async function cancelRide(
  rideId: number,
  where: { riderToken?: string; driverId?: number; driverPhone?: string; admin?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const row = await loadRide(rideId);
  if (!row) return { ok: false, error: "الرحلة غير موجودة" };

  const allowed =
    where.admin === true ||
    (where.riderToken ? riderTokenMatches(String(row.rider_token || ""), where.riderToken) : false) ||
    (where.driverId !== undefined && Number(row.driver_id) === where.driverId) ||
    (where.driverPhone ? row.driver_phone === where.driverPhone : false);

  if (!allowed) {
    return { ok: false, error: "غير مصرح بإلغاء هذه الرحلة" };
  }

  const { error } = await admin
    .from("rides")
    .update({ status: "cancelled" })
    .eq("id", rideId)
    .in("status", ["pending", "accepted"]);

  if (error) return { ok: false, error: "فشل الإلغاء: " + error.message };
  return { ok: true };
}

/** رفع السعر 20% (صاحب الرحلة فقط وهي pending) */
export async function raisePrice(
  rideId: number,
  riderToken: string
): Promise<{ ok: boolean; price?: number; error?: string }> {
  const admin = getSupabaseAdmin();
  const row = await loadRide(rideId);
  if (!row) return { ok: false, error: "الرحلة غير موجودة" };
  if (!riderTokenMatches(String(row.rider_token || ""), riderToken)) {
    return { ok: false, error: "غير مصرح بهذه الرحلة" };
  }
  if (row.status !== "pending") {
    return { ok: false, error: "لا يمكن رفع السعر إلا أثناء البحث عن سائق" };
  }

  const current = Number(row.offered_price);
  const newPrice =
    Number.isFinite(current) && current > 0 ? Math.round(current * 1.2) : 0;
  if (newPrice <= 0) return { ok: false, error: "حدّد سعراً أولاً في نموذج الطلب" };

  const { error } = await admin.from("rides").update({ offered_price: newPrice }).eq("id", rideId);
  if (error) return { ok: false, error: "فشل رفع السعر: " + error.message };
  return { ok: true, price: newPrice };
}

/** قبول شرطي (يمنع القبول المزدوج): pending → accepted */
export async function acceptRide(rideId: number, driverId: number, driverPhone: string) {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("rides")
    .update({
      status: "accepted",
      driver_id: driverId,
      driver_phone: driverPhone,
    })
    .eq("id", rideId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) {
    // لا صفوف مطابقة = سُبق القبول
    if (String(error.message).includes("0 rows")) {
      return { ok: false, conflict: true };
    }
    return { ok: false, conflict: false, error: "فشل القبول: " + error.message };
  }
  if (!data) return { ok: false, conflict: true };
  return { ok: true, ride: toDriverRide(data as Record<string, unknown>) };
}

/** إنهاء مشوار السائق نفسه */
export async function completeRide(
  rideId: number,
  driverId: number,
  driverPhone: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const row = await loadRide(rideId);
  if (!row) return { ok: false, error: "الرحلة غير موجودة" };
  if (row.status !== "accepted") return { ok: false, error: "الرحلة ليست قيد التنفيذ" };
  const mine = Number(row.driver_id) === driverId || row.driver_phone === driverPhone;
  if (!mine) return { ok: false, error: "هذه ليست رحلتك" };

  const { error } = await admin.from("rides").update({ status: "completed" }).eq("id", rideId);
  if (error) return { ok: false, error: "فشل الإنهاء: " + error.message };
  return { ok: true };
}
