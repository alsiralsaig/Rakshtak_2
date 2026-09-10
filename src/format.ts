/**
 * أدوات تنسيق مشتركة (الهاتف السوداني + الأسعار + قناع الحساب البنكي)
 */

/**
 * تطبيع رقم هاتف سوداني من أي صيغة إدخال شائعة:
 *   0912345678 | 912345678 | +249912345678 | 00249912345678 | +249 91 234 5678
 * يرجع الصيغة الموحدة "+2499XXXXXXXX" أو null إذا كان الرقم غير صالح (9 أرقام تبدأ بـ 9).
 */
export function normalizeSudanesePhone(raw: string): string | null {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;

  // إزالة بادئات دولية: 00 ثم 249 ثم 0 محلي
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("249")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return /^9\d{8}$/.test(digits) ? `+249${digits}` : null;
}

/** تحقق سريع من أن النص رقم سوداني صحيح (نفس منطق التطبيع) */
export function isValidSudanesePhone(raw: string): boolean {
  return normalizeSudanesePhone(raw) !== null;
}

/** تنسيق مبلغ بفاصلات الآلاف — مثال: 1,500 ج.س */
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * قناع رقم الحساب البنكي: يُظهر آخر 4 أرقام فقط.
 * مثال: 1234567890 ← ••••••7890
 */
export function maskAccount(account: string | null | undefined): string {
  const digits = (account || "").replace(/\s+/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}

/** صيغة mm:ss للعدّاد */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
