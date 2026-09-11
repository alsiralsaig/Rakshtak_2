import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * العميل العام — يُستخدم في مسارات API العادية (إنشاء رحلة، تسجيل سائق، إلخ)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * عميل بصلاحيات إدارية كاملة (Service Role) — يُستخدم فقط داخل مسارات /api/admin/*
 * ⚠️ لا تستورد هذا الملف أبداً في مكوّنات العميل ("use client")
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey
);
