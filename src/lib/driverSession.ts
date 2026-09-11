import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * جلسات السائق: قراءة رمز الجلسة من الترويسة والبحث عن السائق في جدول drivers.
 * (في مكتبة مستقلة لأن ملفات Next Route لا تسمح إلا بتصديرات محددة)
 */

export const DRIVER_TOKEN_HEADER = "x-driver-token";

/** قراءة رمز الجلسة من ترويسة الطلب */
export function getDriverToken(request: NextRequest): string {
  return (request.headers.get(DRIVER_TOKEN_HEADER) || "").trim();
}

export interface DriverRow {
  id: number;
  phone: string;
  name: string | null;
  bank_account: string | null;
  vehicle_type: string | null;
  license_number: string | null;
  is_online: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
}

/** إحضار السائق الحالي عبر رمز الجلسة (أو null) */
export async function findDriverByToken(
  token: string
): Promise<DriverRow | null> {
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("drivers")
    .select("id, phone, name, bank_account, vehicle_type, license_number, is_online, current_lat, current_lng")
    .eq("auth_token", token)
    .maybeSingle();
  return (data as DriverRow | null) ?? null;
}

/** تحويل صف السائق إلى الاستجابة الآمنة (بلا auth_token) */
export function serializeDriver(row: DriverRow) {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    bankAccount: row.bank_account,
    vehicleType: row.vehicle_type,
    licenseNumber: row.license_number,
    isOnline: row.is_online,
  };
}
