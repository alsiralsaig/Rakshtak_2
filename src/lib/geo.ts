/**
 * أدوات جغرافية خالصة — لحساب «الأقرب» بين السائق والركاب (pickup_lat/lng)
 */

/** نصف قطر البحث الافتراضي عن طلبات قريبة (كيلومتر) */
export const DEFAULT_SEARCH_RADIUS_KM = 10;

/** مسافة هافرسين بين نقطتين بالكيلومتر */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** حدود مربع تقريبي حول نقطة (للتصفية على مستوى قاعدة البيانات ثم تدقيق المسافة) */
export function radiusBounds(
  lat: number,
  lng: number,
  radiusKm = DEFAULT_SEARCH_RADIUS_KM
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radiusKm / 110.574;
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
  const dLng = radiusKm / (111.32 * cos);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/** تنسيق المسافة: أقل من 1 كم بالأمتار، غير ذلك بالكيلومتر بعشر واحد */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} م`;
  return `${km.toFixed(1)} كم`;
}
