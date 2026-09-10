/**
 * الثوابت العامة المستخدمة في تطبيق ركشتك
 */

export interface ServiceType {
  value: string;
  icon: string;
}

/** أنواع الخدمات المتاحة في التطبيق */
export const SERVICE_TYPES: ServiceType[] = [
  { value: "ركشة ركاب", icon: "🛺" },
  { value: "تكسي", icon: "🚕" },
  { value: "توصيل طرود", icon: "📦" },
];

/** حالات الرحلة المعتمدة في النظام */
export type RideStatus = "pending" | "accepted" | "completed" | "cancelled";

export interface StatusMetaEntry {
  /** النص الظاهر (مع الأيقونة) */
  label: string;
  icon: string;
  /** كلاسات Tailwind كاملة (bg/text/border) جاهزة للاستخدام المباشر */
  className: string;
}

/** بيانات وصفية لكل حالة رحلة: النص الظاهر، الأيقونة، وكلاسات التنسيق */
export const STATUS_META: Record<RideStatus, StatusMetaEntry> = {
  pending: {
    label: "⏳ منتظر",
    icon: "⏳",
    className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  accepted: {
    label: "🟢 جاري",
    icon: "🟢",
    className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  completed: {
    label: "🏁 مكتمل",
    icon: "🏁",
    className: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
  cancelled: {
    label: "❌ ملغي",
    icon: "❌",
    className: "bg-red-500/10 text-red-400 border border-red-500/20",
  },
};

/**
 * تطبيع أي قيمة حالة واردة (قد تكون بأحرف مختلفة أو فارغة) إلى إحدى
 * الحالات المعتمدة في RideStatus. القيمة الافتراضية عند عدم التطابق: "pending"
 */
export function canonicalRideStatus(raw: string | null | undefined): RideStatus {
  const value = (raw || "").trim().toLowerCase();
  if (value === "pending" || value === "accepted" || value === "completed" || value === "cancelled") {
    return value;
  }
  return "pending";
}

/**
 * إرجاع النص المعروض (أيقونة + اسم) لنوع خدمة معين بناءً على قيمته.
 * إن لم يوجد تطابق في SERVICE_TYPES، يرجع القيمة الأصلية كما هي.
 */
export function serviceTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const match = SERVICE_TYPES.find((s) => s.value === value);
  return match ? `${match.icon} ${match.value}` : value;
}
