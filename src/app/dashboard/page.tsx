"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import AdminGate, { getAdminToken, clearAdminToken } from "@/components/AdminGate";

interface RideRow {
  id: number | string;
  serviceType?: string | null;
  pickupLocation?: string | null;
  destination?: string | null;
  status?: string | null;
  createdAt?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  searching: { label: "قيد البحث", className: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  accepted: { label: "قيد التنفيذ", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  arrived: { label: "وصل السائق", className: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
  completed: { label: "مكتملة", className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  cancelled: { label: "ملغاة", className: "bg-red-500/10 text-red-400 border border-red-500/20" },
};

function DashboardContent() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [stats, setStats] = useState({
    totalRides: 0,
    completedRides: 0,
    activeRides: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setGateError(null);
      const token = getAdminToken();
      const res = await fetch("/api/rides", {
        headers: token ? { "x-admin-token": token } : {},
      });

      if (res.status === 401 || res.status === 403) {
        clearAdminToken();
        setLocked(true);
        setGateError("رمز الإدارة غير صحيح أو غير مضبوط على الخادم.");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل جلب البيانات");
      setLocked(false);
      const allRides = Array.isArray(data) ? data : [];
      setRides(allRides);

      const completed = allRides.filter((r) => r.status === "completed").length;
      const active = allRides.filter(
        (r) => r.status === "searching" || r.status === "accepted" || r.status === "arrived"
      ).length;

      setStats({
        totalRides: allRides.length,
        completedRides: completed,
        activeRides: active,
      });
    } catch (error) {
      console.error("خطأ في جلب بيانات لوحة التحكم:", error);
      setGateError(error instanceof Error ? error.message : "خطأ في جلب البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-white p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* الهيدر */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-400">لوحة التحكم - ركشتك 🛺</h1>
            <p className="text-xs text-slate-400 mt-1">متابعة كافة الطلبات والإحصائيات المباشرة</p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            🔄 تحديث البيانات
          </button>
        </div>

        {/* كروت الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#12161f] border border-slate-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs text-slate-400">إجمالي الطلبات</p>
            <p className="text-3xl font-black text-white mt-2">{stats.totalRides}</p>
          </div>

          <div className="bg-[#12161f] border border-slate-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs text-slate-400">الطلبات المكتملة</p>
            <p className="text-3xl font-black text-emerald-400 mt-2">{stats.completedRides}</p>
          </div>

          <div className="bg-[#12161f] border border-slate-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs text-slate-400">الطلبات النشطة (بحث/تنفيذ)</p>
            <p className="text-3xl font-black text-amber-400 mt-2">{stats.activeRides}</p>
          </div>
        </div>

        {gateError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            <span>⚠️ {gateError}</span>
            {locked && (
              <button
                type="button"
                onClick={() => { clearAdminToken(); window.location.reload(); }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1.5 rounded-lg border border-red-500/30 font-bold transition"
              >
                إعادة إدخال الرمز 🔐
              </button>
            )}
          </div>
        )}

        {/* جدول أو قائمة الرحلات */}
        <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white">سجل الرحلات والأوامر</h2>

          {loading ? (
            <div className="text-center py-10 text-xs text-slate-500 animate-pulse">
              جاري تحميل البيانات...
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              لا توجد رحلات مسجلة في النظام حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-2">الخدمة</th>
                    <th className="py-3 px-2">نقطة الانطلاق</th>
                    <th className="py-3 px-2">الوجهة</th>
                    <th className="py-3 px-2">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {rides.map((ride) => {
                    const statusInfo = STATUS_LABELS[ride.status || ""] || {
                      label: ride.status || "—",
                      className: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
                    };
                    return (
                      <tr key={ride.id} className="hover:bg-slate-800/20">
                        <td className="py-3 px-2 font-bold text-amber-400">
                          {ride.serviceType || "ركشة"}
                        </td>
                        <td className="py-3 px-2 text-white">{ride.pickupLocation || "—"}</td>
                        <td className="py-3 px-2 text-white">{ride.destination || "—"}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AdminGate title="بوابة لوحة التحكم">
      <DashboardContent />
    </AdminGate>
  );
}
