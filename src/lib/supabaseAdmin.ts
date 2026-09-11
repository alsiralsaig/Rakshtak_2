import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل Supabase للخادم فقط (Service Role) — يُستخدم حصراً في مسارات الخادم:
 * إدارة السائقين، رموز OTP، وبيانات الهوية.
 *
 * ⚠️ لا يُستورد من أي ملف يعمل في المتصفح — المفتاح سري ولا يظهر في NEXT_PUBLIC.
 * يتطلب ضبط SUPABASE_SERVICE_ROLE_KEY على Vercel (و .env.local محلياً).
 */
let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير مضبوط على الخادم — لا يمكن إدارة حسابات السائقين ورموز التحقق."
    );
  }

  cachedAdmin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}
