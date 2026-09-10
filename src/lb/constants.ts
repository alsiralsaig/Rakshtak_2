
Constants · TS
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
 
