"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminGate, { getAdminToken, clearAdminToken } from "@/components/AdminGate";
import { canonicalRideStatus, serviceTypeLabel, STATUS_META, SERVICE_TYPES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

/** ترويسة الإدارة (مطابقة لـ src/lib/admin.ts على الخادم) */
const ADMIN_TOKEN_HEADER = "x-admin-token";

/* ════════════════════════════════════════════════════════════════════
 * لوحة الإدارة — المرحلة 3:
 * لا وصول مباشر لـ Supabase من المتصفح إطلاقاً — كل شيء عبر مسارات
 * الخادم الحاملة لـ x-admin-token:
 * GET  /api/admin/rides (آخر 100 رحلة + إحصائيات)
 * DELETE /api/admin/rides/[id] (حذف)
 * POST  /api/admin/rides/[id]/lock (إعادة فتح مشوار عالق للسائقين)
 * (RLS + منع anon بعد تشغيل supabase/phase3.sql)
 * ════════════════════════════════════════════════════════════════════ */

interface AdminRide {
  id: string | number;
  passenger_name?: string;
  phone_number?: string;
  pickup_location?: string;
  destination?: string;
  offered_price?: number | null;
  service_type?: string;
  status?: string;
  driver_phone?: string | null;
  driver_id?: number | null;
  created_at?: string | null;
}

const REFRESH_MS = 15000;

/** نص SQL التشغيل (المرحلتان) — للنسخ إلى Supabase SQL Editor */
const RUNBOOK_SQL = `-- 1) نفّذ supabase/phase2.sql مرة واحدة (الجداول + OTP + الأعمدة)
-- 2) ثم نفّذ supabase/phase3.sql مرة واحدة (تفعيل RLS + rider_token + منع anon)
-- (الملفان موجودان في مجلد supabase/ داخل المشروع)`;

export default function AdminDashboard() {
  return (
    <AdminGate title="بوابة لوحة تحكم الأدمن">
      <AdminContent />
    </AdminGate>
  );
}

function AdminContent() {
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [stats, setStats] = useState<{ total: number; pending: number; accepted: number; completed: number; cancelled: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const busylockRef = useRef<Set<string>>(new Set());

  /** تنفيذ أي استدعاء خادم مع ترويسة الإدارة */
  const backend = useCallback(async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    const token = getAdminToken();
    if (token) headers[ADMIN_TOKEN_HEADER] = token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(path, {
      method: opts.method || "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, status: res.status, data };
  }, []);

  const fetchAllRides = useCallback(async () => {
    try {
      const { ok, data } = await backend("/api/admin/rides");
      if (ok) {
        setRides((data.rides || []).map((r: any) => ({ ...r, status: canonicalRideStatus(r.status) })));
        setStats(data.stats || null);
        setErrorMsg(null);
      } else {
        setErrorMsg(data.error || "فشل جلب الرحلات");
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [backend]);

  // جلب فوري + استطلاع دوري (بديلاً عن realtime بعد RLS)
  useEffect(() => {
    if (typeof window === "undefined" || !getAdminToken()) return;
    void fetchAllRides();
    const timer = setInterval(fetchAllRides, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAllRides]);

  /** حذف رحلة (الإدارة فقط) */
  const deleteRide = async (id: string | number) => {
    if (!window.confirm(`متأكد من حذف الرحلة #${id} نهائياً؟ لا يمكن التراجع.`)) return;
    const key = `del:${id}`;
    if (busylockRef.current.has(key)) return;
    busylockRef.current.add(key);
    try {
      const { ok, data } = await backend(`/api/admin/rides/${id}`, { method: "DELETE" });
      if (ok) {
        setNotice(`تم حذف الرحلة #${id} 🗑️`);
        setRides((prev) => prev.filter((r) => String(r.id) !== String(id)));
      } else {
        setErrorMsg(data.error || "فشل الحذف");
      }
    } finally {
      busylockRef.current.delete(key);
    }
  };

  /** إلغاء رحلة (الإدارة) */
  const cancelRide = async (id: string | number) => {
    if (!window.confirm(`إلغاء الرحلة #${id}؟`)) return;
    const key = `cancel:${id}`;
    if (busylockRef.current.has(key)) return;
    busylockRef.current.add(key);
    try {
      const { ok, data } = await backend(`/api/rides/${id}/cancel`, { method: "POST" });
      if (ok) {
        setNotice(`تم إلغاء الرحلة #${id} ✅`);
        void fetchAllRides();
      } else {
        setErrorMsg(data.error || "فشل الإلغاء");
      }
    } finally {
      busylockRef.current.delete(key);
    }
  };

  /** إعادة فتح مشوار عالق (accepted → pending) */
  const unlockRide = async (id: string | number) => {
    if (!window.confirm(`إعادة فتح الرحلة #${id} للسائقين؟ ستُحذف بيانات السائق الحالي.`)) return;
    const key = `unlock:${id}`;
    if (busylockRef.current.has(key)) return;
    busylockRef.current.add(key);
    try {
      const { ok, data } = await backend(`/api/admin/rides/${id}/lock`, { method: "POST" });
      if (ok) {
        setNotice(`أعيد فتح الرحلة #${id} 🔓 تظهر الآن للطلبات المتاحة`);
        void fetchAllRides();
      } else {
        setErrorMsg(data.error || "فشل إعادة الفتح");
      }
    } finally {
      busylockRef.current.delete(key);
    }
  };

  const logout = () => {
    clearAdminToken();
    window.location.href = "/";
  };

  const filtered = rides.filter((r) => (statusFilter === "all" ? true : r.status === statusFilter));

  const statCard = (label: string, value: number | undefined, cls: string) => (
    <div className={`rounded-2xl px-3 py-3 text-center ${cls}`}>
      <div className="text-2xl font-extrabold">{value ?? 0}</div>
      <div className="text-[10px] font-semibold mt-0.5 opacity-80">{label}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050b1a] via-[#0a1830] to-[#102a52] text-slate-100 p-4 flex flex-col justify-between w-full min-w-full">
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col justify-between space-y-4">
        <header className="flex justify-between items-center pt-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛠️</span>
            <span className="font-extrabold text-xl text-white tracking-wide">لوحة تحكم الإدارة</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void fetchAllRides(); }}
              className="bg-[#122747] hover:bg-[#1a3564] text-slate-300 font-bold text-[11px] px-3 py-2 rounded-xl border border-blue-900/60 transition"
            >
              تحديث 🔄
            </button>
            <button
              onClick={logout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[11px] px-3 py-2 rounded-xl border border-red-500/25 transition"
            >
              خروج 🔒
            </button>
          </div>
        </header>

        {notice && (
          <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            ✅ {notice}
          </p>
        )}
        {errorMsg && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 leading-relaxed">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* إحصائيات */}
        <div className="grid grid-cols-5 gap-2">
          {statCard("الكل", stats?.total, "bg-[#122747]/60 border border-blue-900/60")}
          {statCard("⏳ قيد البحث", stats?.pending, "bg-amber-500/10 border border-amber-500/20 text-amber-400")}
          {statCard("🟢 جاري", stats?.accepted, "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400")}
          {statCard("🏁 مكتملة", stats?.completed, "bg-blue-500/10 border border-blue-500/20 text-blue-400")}
          {statCard("❌ ملغاة", stats?.cancelled, "bg-red-500/10 border border-red-500/20 text-red-400")}
        </div>

        {/* فلترة الحالة */}
        <div className="flex items-center justify-between gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0f2347] border border-blue-900/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">⏳ قيد البحث</option>
            <option value="accepted">🟢 جاري التنفيذ</option>
            <option value="completed">🏁 مكتملة</option>
            <option value="cancelled">❌ ملغاة</option>
          </select>
          <span className="text-[11px] text-slate-500">
            آخر {rides.length} رحلة — تحديث تلقائي كل {Math.round(REFRESH_MS / 1000)} ثانية
          </span>
        </div>

        {/* جدول الرحلات */}
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-sm animate-pulse">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 bg-[#0f2347] border border-blue-950/70 rounded-2xl text-slate-500 text-xs font-medium">
            لا توجد رحلات{statusFilter !== "all" ? " بهذه الحالة" : ""} حالياً.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((ride) => {
              const status = ride.status as keyof typeof STATUS_META;
              const meta = STATUS_META[status] || STATUS_META.pending;
              const price = formatPrice(ride.offered_price);
              return (
                <div key={ride.id} className="bg-[#0f2347] border border-blue-950/70 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 font-mono text-[10px]">#{ride.id}</span>
                      <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-lg font-bold text-[10px]">
                        {serviceTypeLabel(ride.service_type)}
                      </span>
                      {price && (
                        <span className="font-mono font-bold text-emerald-400 text-[11px]">
                          💰 {price} ج.س
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {ride.created_at ? new Date(ride.created_at).toLocaleString("ar-SD") : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                    <div className="truncate">👤 {ride.passenger_name || "—"}</div>
                    <div dir="ltr" className="text-left">
                      📞 {ride.phone_number || "—"}
                    </div>
                    <div className="truncate">📍 من: {ride.pickup_location || "—"}</div>
                    <div className="truncate">🏁 إلى: {ride.destination || "—"}</div>
                    <div className="truncate">
                      🚖 السائق:{" "}
                      {ride.driver_phone ? (
                        <a href={`tel:${ride.driver_phone}`} className="font-mono text-amber-400 hover:underline" dir="ltr">
                          {ride.driver_phone}
                        </a>
                      ) : ride.driver_id ? (
                        <span className="font-mono text-slate-400">#{ride.driver_id}</span>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    {ride.status === "accepted" && (
                      <button
                        onClick={() => unlockRide(ride.id)}
                        className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 rounded-lg font-bold text-[10px] transition"
                      >
                        🔓 إعادة فتح للسائقين
                      </button>
                    )}
                    {(ride.status === "pending" || ride.status === "accepted") && (
                      <button
                        onClick={() => cancelRide(ride.id)}
                        className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-lg font-bold text-[10px] transition"
                      >
                        ❌ إلغاء
                      </button>
                    )}
                    <button
                      onClick={() => deleteRide(ride.id)}
                      className={`py-2 ${ride.status === "accepted" ? "flex-1" : "flex-1"} bg-[#122747] hover:bg-[#1a3564] text-slate-400 border border-blue-900/60 rounded-lg font-bold text-[10px] transition`}
                    >
                      🗑️ حذف نهائي
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* دليل تشغيل SQL */}
        <details className="bg-[#0b1830] border border-blue-950/70 rounded-2xl">
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-300 hover:text-amber-400 transition select-none">
            🗄️ دليل تشغيل قاعدة البيانات (اضغط للنسخ — مطلوب مرة واحدة على Supabase)
          </summary>
          <div className="px-4 pb-4 space-y-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              لوحة Supabase ← SQL Editor ← نفّذ <code className="text-amber-400">phase2.sql</code> ثم{" "}
              <code className="text-amber-400">phase3.sql</code> (الملفان في مجلد{" "}
              <code className="text-amber-400">supabase/</code> بالمشروع). بعد phase3 يتوقف وصول المتصفح
              (anon) للجداول نهائياً وتعمل كل العمليات عبر مسارات الخادم فقط.
            </p>
            <div className="flex items-start gap-2">
              <textarea
                readOnly
                value={RUNBOOK_SQL}
                rows={4}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-[#0f2347] border border-blue-950/70 rounded-xl p-2.5 text-[10px] font-mono text-emerald-300/90 leading-relaxed resize-y focus:outline-none"
                dir="ltr"
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(RUNBOOK_SQL);
                  } catch {
                    /* تجاهل */
                  }
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-xl text-[10px] font-bold transition"
              >
                {copied ? "تم النسخ ✅" : "نسخ 📋"}
              </button>
            </div>
            <div className="text-[10px] text-slate-500 leading-relaxed">
              أنواع الخدمة الموحّدة: {SERVICE_TYPES.map((s) => `${s.icon} ${s.value}`).join(" · ")}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
