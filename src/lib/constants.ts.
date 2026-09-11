/**
 * القيم الموحّدة للمشروع — مصدر الحقيقة الوحيد لأنواع الخدمة وحالات الرحلة.
 *
 * المرحلة 2: أُلغي التعدد القديم (ride/goods إنجليزي مقابل عربي في طبقة Neon)
 * وكل القيم الآن عربية موحّدة تُستخدم في الإدخال والعرض والفلترة معاً.
 */

// ── أنواع الخدمة الموحّدة ──────────────────────────────────────────────
export const SERVICE_TYPES = [
  { value: "ركشة ركاب", icon: "🛺", kind: "ride" },
  { value: "توك توك بضائع", icon: "📦", kind: "goods" },
  { value: "تكسي", icon: "🚕", kind: "taxi" },
] as const;

export type ServiceTypeValue = (typeof SERVICE_TYPES)[number]["value"];

/** صيغ قديمة (إنجليزية أو مختصرة) → القيمة الموحّدة */
const LEGACY_SERVICE_MAP: Record<string, string> = {
  ride: "ركشة ركاب",
  goods: "توك توك بضائع",
  taxi: "تكسي",
  "ركشة": "ركشة ركاب",
  "توك توك": "توك توك بضائع",
};

/** تحويل أي قيمة (قديمة/جديدة/فارغة) إلى التسمية العربية الموحّدة للعرض */
export function serviceTypeLabel(value: string | null | undefined): string {
  if (!value) return "ركشة ركاب";
  if (SERVICE_TYPES.some((s) => s.value === value)) return value;
  return LEGACY_SERVICE_MAP[value] ?? value;
}

// ── حالات الرحلة الموحّدة (Supabase الحي) ─────────────────────────────
export const RIDE_STATUSES = ["pending", "accepted", "completed", "cancelled"] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

/** حالات الطبقة القديمة المحذوفة ← الحالة المكافئة في النظام الموحّد */
const LEGACY_STATUS_MAP: Record<string, RideStatus> = {
  searching: "pending",
  arrived: "accepted",
};

/** تطبيع أي حالة قديمة إلى الحالات الموحّدة (للعرض والفلترة) */
export function canonicalRideStatus(status: string | null | undefined): RideStatus {
  if (status && (RIDE_STATUSES as readonly string[]).includes(status)) {
    return status as RideStatus;
  }
  if (status && LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  return "pending";
}

/** بيانات عرض الحالة الموحّدة */
export const STATUS_META: Record<RideStatus, { label: string; className: string }> = {
  pending: {
    label: "⏳ قيد البحث",
    className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  accepted: {
    label: "🟢 جاري التنفيذ",
    className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  completed: {
    label: "🏁 مكتملة",
    className: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
  cancelled: {
    label: "❌ ملغاة",
    className: "bg-red-500/10 text-red-400 border border-red-500/20",
  },
};
