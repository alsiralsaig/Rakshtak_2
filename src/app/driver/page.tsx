"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Map from "@/components/Map";
import { normalizeSudanesePhone, formatPrice, maskAccount } from "@/lib/format";
import { serviceTypeLabel } from "@/lib/constants";

/* ════════════════════════════════════════════════════════════════════
 *  لوحة السائق — المرحلة 3:
 *  كل العمليات عبر مسارات الخادم (بعد RLS لا يصل المتصفح للجداول مباشرة):
 *  GET/POST /api/driver/* + استطلاع دوري للطلبات كل 5 ثوانٍ
 *  • دخول OTP حقيقي • driver_id integer FK • «مشواري أنا» فقط
 *  • الطلبات الأقرب (pickup_lat/lng) • قبول شرطي يمنع المزدوج • WebAudio داخلي
 * ════════════════════════════════════════════════════════════════════ */

interface Ride {
  id: number | string;
  status: string;
  serviceType: string;
  pickupLocation: string;
  destination: string;
  offeredPrice: number | null;
  driverId: number | null;
  driverPhone: string | null;
  passengerName: string;
  phoneNumber: string;
  distanceKm: number | null;
  createdAt: string | null;
}

interface DriverProfile {
  id: number;
  phone: string;
  name: string;
  bankAccount: string | null;
  vehicleType: string | null;
  isOnline: boolean;
}

const POLL_MS = 5000;
const DRIVER_TOKEN_KEY = "driver_token";
const sameId = (a: unknown, b: unknown) =>
  a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

type AuthStage = "login" | "code" | "ready";

export default function DriverDashboard() {
  const [stage, setStage] = useState<AuthStage>("login");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [codeDigits, setCodeDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [bankDraft, setBankDraft] = useState("");
  const [vehicleDraft, setVehicleDraft] = useState("");
  const [showBank, setShowBank] = useState(false);

  const [isAvailable, setIsAvailable] = useState(true);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "current">("available");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const profileRef = useRef<DriverProfile | null>(null);
  const currentRideRef = useRef<Ride | null>(null);
  const acceptingRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncProfile = useCallback((p: DriverProfile | null) => {
    profileRef.current = p;
    setProfile(p);
  }, []);

  const syncCurrentRide = useCallback((ride: Ride | null) => {
    currentRideRef.current = ride;
    setCurrentRide(ride);
  }, []);

  const tokenOf = () => (typeof window !== "undefined" ? localStorage.getItem(DRIVER_TOKEN_KEY) : null);

  // ── تنبيه WebAudio داخلي ─────────────────────────────────────────
  const playAlert = useCallback(() => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      });
    } catch (err) {
      console.log("Audio notification error:", err);
    }
  }, []);

  /** تنبيه فقط للطلبات الجديدة فعلاً (لا عند فتح الصفحة) */
  const alertIfNew = useCallback(
    (rides: Ride[]) => {
      const fresh = rides.filter((r) => !knownIdsRef.current.has(String(r.id)));
      if (fresh.length > 0 && !currentRideRef.current) playAlert();
      fresh.forEach((r) => knownIdsRef.current.add(String(r.id)));
    },
    [playAlert]
  );

  // ── الاستطلاع الدوري عبر الخادم ──────────────────────────────────
  const pollRides = useCallback(async () => {
    const token = tokenOf();
    if (!token || !profileRef.current) return;

    try {
      const c = coordsRef.current;
      const qs = c ? `?lat=${c.lat}&lng=${c.lng}` : "";
      const res = await fetch(`/api/driver/rides${qs}`, {
        headers: { "x-driver-token": token },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          localStorage.removeItem(DRIVER_TOKEN_KEY);
          handleLogoutLocal();
        }
        return;
      }

      const available: Ride[] = (data.available || []).map((r: any) => ({ ...r }));
      alertIfNew(available);
      setAvailableRides(available);

      // «مشواري أنا» فقط — والخادم لا يعيد إلا رحلتي
      const cur = data.current as Ride | null;
      const prev = currentRideRef.current;
      if (cur) {
        syncCurrentRide(cur);
        if (prev && sameId(prev.id, cur.id) && prev.status === "accepted" && cur.status === "accepted") {
          // نفس المشوار
        }
      } else if (prev) {
        // اختفى المشوار الحالي: اكتمل أو أُلغي — اسأل برسالة محايدة
        alert("تم إنهاء المشوار أو إلغاؤه 🏁");
        syncCurrentRide(null);
        setActiveTab("available");
      }
    } catch {
      /* تجاهل أخطاء الشبكة المؤقتة */
    }
  }, [alertIfNew, syncCurrentRide]);

  /** خروج محلي (بعد 401) */
  const handleLogoutLocal = () => {
    syncProfile(null);
    syncCurrentRide(null);
    setAvailableRides([]);
    setStage("login");
    setCodeDigits("");
    setAuthInfo(null);
    setPreviewCode(null);
    knownIdsRef.current = new Set();
  };

  // استعادة الجلسة
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(DRIVER_TOKEN_KEY);
    const legacyPhone = localStorage.getItem("driver_phone");
    if (legacyPhone && !token) {
      const norm = normalizeSudanesePhone(legacyPhone);
      if (norm) setPhoneDigits(norm.replace("+249", ""));
    }
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/driver/me", {
          headers: { "x-driver-token": token },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.ok && data.driver) {
          const p: DriverProfile = {
            id: Number(data.driver.id),
            phone: data.driver.phone,
            name: data.driver.name || "",
            bankAccount: data.driver.bankAccount || null,
            vehicleType: data.driver.vehicleType || null,
            isOnline: data.driver.isOnline !== false,
          };
          syncProfile(p);
          setPhoneDigits(p.phone.replace("+249", ""));
          setIsAvailable(p.isOnline);
          setStage("ready");
          locateDriver(false);
          return;
        }
        localStorage.removeItem(DRIVER_TOKEN_KEY);
        setAuthError("انتهت جلستك — سجّل الدخول برمز التحقق من جديد");
      } catch {
        if (!cancelled) {
          setAuthError("تعذر الاتصال بالخادم — تأكد من تشغيل المتغيرات ثم أعد المحاولة");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // إشعارات المتصفح
  useEffect(() => {
    if (stage === "ready" && typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().catch(() => {});
    }
  }, [stage]);

  // حلقة الاستطلاع الدوري
  useEffect(() => {
    if (stage !== "ready") return;
    void pollRides();
    pollRef.current = setInterval(pollRides, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stage, pollRides]);

  // تحديد موقع السائق (ثم إرساله للخادم + استطلاع فوري)
  const locateDriver = useCallback(
    (showMsg = true) => {
      if (!navigator.geolocation) {
        if (showMsg) setGeoMsg("متصفحك لا يدعم تحديد الموقع — ستظهر كل الطلبات");
        void pollRides();
        return;
      }
      setLocating(true);
      if (showMsg) setGeoMsg(null);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          coordsRef.current = c;
          setCoords(c);
          setLocating(false);
          if (showMsg) setGeoMsg(null);
          const token = tokenOf();
          if (token) {
            try {
              await fetch("/api/driver/location", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-driver-token": token },
                body: JSON.stringify(c),
              });
            } catch {
              /* تجاهل */
            }
          }
          void pollRides();
        },
        () => {
          setLocating(false);
          coordsRef.current = null;
          setCoords(null);
          if (showMsg) setGeoMsg("تعذر تحديد موقعك — ستظهر كل الطلبات (بدون ترتيب الأقرب)");
          void pollRides();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    },
    [pollRides]
  );

  // ── OTP: طلب رمز ──────────────────────────────────────────────
  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const phone = normalizeSudanesePhone(phoneDigits);
    if (!phone) {
      setAuthError("أدخل رقم هاتف سوداني صحيح (9 أرقام تبدأ بـ 9)");
      return;
    }
    setBusy(true);
    setAuthError(null);
    setAuthInfo(null);
    setPreviewCode(null);
    try {
      const res = await fetch("/api/driver/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStage("code");
        setAuthInfo(data.message || "تم إرسال رمز التحقق إلى هاتفك");
        setPreviewCode(data.previewCode || null);
      } else {
        setAuthError(data.error || "تعذر إرسال الرمز — حاول مرة أخرى");
      }
    } catch {
      setAuthError("خطأ في الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  // ── OTP: تحقق ودخول ───────────────────────────────────────────
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const phone = normalizeSudanesePhone(phoneDigits);
    if (!phone || !/^\d{6}$/.test(codeDigits)) {
      setAuthError("أدخل رمز التحقق (6 أرقام)");
      return;
    }
    setBusy(true);
    setAuthError(null);
    try {
      const payload: Record<string, string> = { phone, code: codeDigits };
      if (nameDraft.trim()) payload.name = nameDraft.trim();
      if (bankDraft.trim()) payload.bankAccount = bankDraft.replace(/\s+/g, "");
      if (vehicleDraft.trim()) payload.vehicleType = vehicleDraft.trim();

      const res = await fetch("/api/driver/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.driver) {
        setAuthError(data.error || "فشل التحقق — حاول مرة أخرى");
        return;
      }

      const p: DriverProfile = {
        id: Number(data.driver.id),
        phone: data.driver.phone,
        name: data.driver.name || "",
        bankAccount: data.driver.bankAccount || null,
        vehicleType: data.driver.vehicleType || null,
        isOnline: data.driver.isOnline !== false,
      };
      syncProfile(p);
      localStorage.setItem(DRIVER_TOKEN_KEY, data.token);
      localStorage.setItem("driver_id", String(p.id));
      localStorage.setItem("driver_phone", p.phone);
      setIsAvailable(p.isOnline);
      setStage("ready");
      setCodeDigits("");
      knownIdsRef.current = new Set();
      locateDriver();
    } catch {
      setAuthError("خطأ في الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(DRIVER_TOKEN_KEY);
    localStorage.removeItem("driver_id");
    localStorage.removeItem("driver_phone");
    handleLogoutLocal();
  };

  // ── تحديث الملف ───────────────────────────────────────────────
  const saveProfile = async () => {
    const token = tokenOf();
    if (!token) return;
    setBusy(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/driver/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-driver-token": token },
        body: JSON.stringify({
          name: nameDraft,
          bankAccount: bankDraft.replace(/\s+/g, ""),
          vehicleType: vehicleDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.driver) {
        const p = profileRef.current;
        if (p) {
          syncProfile({
            ...p,
            name: data.driver.name || p.name,
            bankAccount: data.driver.bankAccount ?? p.bankAccount,
            vehicleType: data.driver.vehicleType ?? p.vehicleType,
          });
        }
        setEditingProfile(false);
        setAuthInfo("تم حفظ بياناتك ✅");
      } else {
        setAuthError(data.error || "فشل الحفظ");
      }
    } catch {
      setAuthError("خطأ في الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  // ── التوفر ────────────────────────────────────────────────────
  const toggleAvailability = async () => {
    const p = profileRef.current;
    if (!p) return;
    const next = !isAvailable;
    const token = tokenOf();
    setIsAvailable(next);
    try {
      if (token) {
        const res = await fetch("/api/driver/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-driver-token": token },
          body: JSON.stringify({ isOnline: next }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok && data.driver) {
          syncProfile({ ...p, isOnline: data.driver.isOnline !== false });
          return;
        }
      }
      setIsAvailable(!next);
      setAuthError("تعذر حفظ الحالة على الخادم");
    } catch {
      setIsAvailable(!next);
    }
  };

  // ── القبول (شرطي عبر الخادم — يمنع المزدوج) ───────────────────
  const acceptRide = async (ride: Ride) => {
    const p = profileRef.current;
    const token = tokenOf();
    if (!p || !token) return;
    if (acceptingRef.current) return;
    if (currentRideRef.current) {
      alert("عندك مشوار حالي — أنهيه أولاً قبل ما تقبل طلب جديد");
      return;
    }
    if (!isAvailable) {
      alert("فعّل «متاح للطلبات 🟢» أولاً عشان تقدر تقبل مشاوير");
      return;
    }

    acceptingRef.current = true;
    try {
      const res = await fetch(`/api/rides/${ride.id}/accept`, {
        method: "POST",
        headers: { "x-driver-token": token },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || !res.ok) {
        alert(data.error || "تعذر قبول الطلب");
        void pollRides();
        return;
      }
      if (data.ride) syncCurrentRide(data.ride as Ride);
      setActiveTab("current");
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      acceptingRef.current = false;
    }
  };

  // ── إنهاء المشوار ─────────────────────────────────────────────
  const completeRide = async (rideId: string | number) => {
    const token = tokenOf();
    if (!token || acceptingRef.current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rides/${rideId}/complete`, {
        method: "POST",
        headers: { "x-driver-token": token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "تعذر إنهاء المشوار");
        return;
      }
      alert("تم إنهاء المشوار 🏁");
      syncCurrentRide(null);
      setActiveTab("available");
      void pollRides();
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  const maskedBank = profile?.bankAccount ? maskAccount(profile.bankAccount) : "—";
  const showDriver = stage === "ready" && profile;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050b1a] via-[#0a1830] to-[#102a52] text-slate-100 p-4 flex flex-col justify-between w-full min-w-full">
      <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-between space-y-4">
        <header className="flex justify-between items-center pt-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚖</span>
            <span className="font-extrabold text-xl text-white tracking-wide">لوحة السائق</span>
          </div>
          <button
            type="button"
            onClick={() => { window.location.href = "/"; }}
            className="bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-400 font-bold text-sm px-4 py-2.5 rounded-xl border border-amber-500/30 transition flex items-center gap-2 shadow-lg"
          >
            <span>🛺</span> الرئيسية (الراكب)
          </button>
        </header>

        {/* ══════════ شاشة الدخول برمز التحقق ══════════ */}
        {stage !== "ready" ? (
          <div className="space-y-5 py-6 flex-1 flex flex-col justify-center">
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-white">دخول السائق 🚖</h2>
              <p className="text-xs text-slate-400">
                {stage === "login"
                  ? "أدخل رقم هاتفك وسيصلك رمز تحقق (OTP) — لا مزيد من الدخول بدون تحقق"
                  : "أدخل الرمز المكوّن من 6 أرقام الذي وصل إلى هاتفك"}
              </p>
            </div>

            {stage === "login" ? (
              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">📞 رقم الهاتف:</label>
                  <div
                    className="flex items-stretch border border-blue-900/60 rounded-xl overflow-hidden bg-[#0b1830] focus-within:border-amber-500"
                    style={{ direction: 'ltr' }}
                  >
                    <div className="bg-[#122747] text-amber-400 px-3.5 py-3 text-sm font-mono font-bold border-r border-blue-900/60 flex items-center gap-1.5 select-none shrink-0">
                      <span>🇸🇩</span>
                      <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>+249</span>
                    </div>
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      maxLength={10}
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9XXXXXXXX"
                      className="w-full bg-transparent px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none font-mono text-left"
                      style={{ direction: 'ltr' }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold rounded-2xl text-base shadow-xl transition mt-2 disabled:opacity-50"
                >
                  {busy ? "جاري الإرسال..." : "إرسال رمز التحقق 📲"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                {authInfo && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
                    ✅ {authInfo}
                  </p>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">🔢 رمز التحقق:</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={codeDigits}
                    onChange={(e) => setCodeDigits(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-center tracking-[0.5em]"
                    dir="ltr"
                  />
                  {previewCode && (
                    <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 mt-2 leading-relaxed">
                      🧪 وضع تجريبي (بدون مزوّد إرسال): استخدم الرمز{" "}
                      <strong className="font-mono text-base tracking-widest">{previewCode}</strong>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">الاسم:</label>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="اختياري"
                      className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">المركبة:</label>
                    <input
                      type="text"
                      value={vehicleDraft}
                      onChange={(e) => setVehicleDraft(e.target.value)}
                      placeholder="مثال: ركشة"
                      className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">🏦 رقم الحساب البنكي:</label>
                  <input
                    type={showBank ? "text" : "password"}
                    value={bankDraft}
                    onChange={(e) => setBankDraft(e.target.value.replace(/\s+/g, ""))}
                    placeholder="اختياري — لتحويل المستحقات"
                    className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none font-mono text-right focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-extrabold rounded-2xl text-base shadow-xl transition mt-2 disabled:opacity-50"
                >
                  {busy ? "جاري التحقق..." : "تحقق وادخل اللوحة ✅"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStage("login"); setAuthInfo(null); setPreviewCode(null); setAuthError(null); }}
                  className="w-full text-center text-xs text-slate-400 hover:text-white underline transition"
                >
                  تغيير رقم الهاتف
                </button>
              </form>
            )}

            {authError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
                ⚠️ {authError}
              </p>
            )}
          </div>
        ) : showDriver ? (
          <>
            {/* شريط معلومات السائق */}
            <div className="flex items-center justify-between bg-[#0b1830] p-3 rounded-2xl border border-blue-950/70 gap-2">
              <div className="text-xs text-slate-300 space-y-1 min-w-0">
                <div className="truncate">
                  {profile.name ? <span className="font-bold text-white">👤 {profile.name}</span> : null}{" "}
                  <span className="font-mono text-amber-400 font-bold" dir="ltr">+249{phoneDigits}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>🏦 الحساب:</span>
                  <span className="font-mono text-amber-400 font-bold" dir="ltr">{maskedBank}</span>
                  {profile.bankAccount && (
                    <button
                      type="button"
                      onClick={() => setShowBank((s) => !s)}
                      className="text-[9px] bg-[#122747] hover:bg-[#1a3564] text-slate-400 px-1.5 py-0.5 rounded border border-blue-900/60 transition"
                    >
                      {showBank ? "إخفاء" : "إظهار"}
                    </button>
                  )}
                </div>
                {profile.vehicleType ? (
                  <div className="text-[10px] text-slate-400">🛺 {profile.vehicleType}</div>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 transition"
                >
                  خروج 🔒
                </button>
                <button
                  onClick={() => {
                    setEditingProfile((v) => !v);
                    setNameDraft(profile.name || "");
                    setBankDraft(profile.bankAccount || "");
                    setVehicleDraft(profile.vehicleType || "");
                    setAuthInfo(null);
                    setAuthError(null);
                  }}
                  className="text-[10px] font-bold text-slate-300 hover:text-white bg-[#122747]/60 px-2.5 py-1.5 rounded-lg border border-blue-900/60 transition"
                >
                  تعديل البيانات ✏️
                </button>
              </div>
            </div>

            {editingProfile && (
              <div className="bg-[#0b1830] border border-blue-900/60 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-300 mb-1 block text-right">الاسم:</label>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="w-full bg-[#0f2347] border border-blue-900/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-300 mb-1 block text-right">المركبة:</label>
                    <input
                      type="text"
                      value={vehicleDraft}
                      onChange={(e) => setVehicleDraft(e.target.value)}
                      className="w-full bg-[#0f2347] border border-blue-900/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-300 mb-1 block text-right">🏦 الحساب البنكي:</label>
                  <input
                    type="text"
                    value={bankDraft}
                    onChange={(e) => setBankDraft(e.target.value.replace(/\s+/g, ""))}
                    className="w-full bg-[#0f2347] border border-blue-900/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono text-right focus:border-amber-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={busy}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition disabled:opacity-50"
                  >
                    {busy ? "جاري الحفظ..." : "حفظ ✅"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="px-4 py-2.5 bg-[#122747] hover:bg-[#1a3564] text-slate-300 font-bold text-xs rounded-xl transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* حالة التواجد + الموقع */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#0b1830] p-3 rounded-2xl border border-blue-950/70">
                <span className="text-sm font-semibold text-slate-300">حالة التواجد:</span>
                <button
                  onClick={toggleAvailability}
                  className={`text-xs px-4 py-2 rounded-xl font-extrabold transition flex items-center gap-2 ${
                    isAvailable
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/30"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? "bg-emerald-400" : "bg-red-400"}`}></span>
                  {isAvailable ? "متاح للطلبات 🟢" : "مشغول / استراحة 🔴"}
                </button>
              </div>

              <div className="flex items-center justify-between bg-[#0b1830] p-3 rounded-2xl border border-blue-950/70">
                <span className="text-xs text-slate-300">
                  {coords
                    ? "📍 موقعك مفعّل — نعرض الطلبات الأقرب خلال 10 كم"
                    : geoMsg || "📍 حدد موقعك لعرض الطلبات الأقرب"}
                </span>
                <button
                  type="button"
                  onClick={() => locateDriver(true)}
                  disabled={locating}
                  className="text-[10px] bg-[#122747] hover:bg-[#1a3564] text-amber-400 px-2.5 py-1.5 rounded-lg border border-blue-900/60 font-bold transition disabled:opacity-50"
                >
                  {locating ? "..." : "تحديث موقعي"}
                </button>
              </div>
            </div>

            {/* الخريطة */}
            <div className="w-full h-44 rounded-2xl overflow-hidden border border-blue-900/40 shadow-xl shrink-0">
              <Map pickupName={currentRide ? currentRide.pickupLocation : "موقعي الحالي"} />
            </div>

            {/* التبويبات */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab("available")}
                className={`py-3 text-xs font-extrabold rounded-xl border transition ${
                  activeTab === "available"
                    ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md"
                    : "bg-[#0b1830] text-slate-400 border-blue-950/70 hover:text-white"
                }`}
              >
                الطلبات المتاحة 🔔 ({availableRides.length})
              </button>
              <button
                onClick={() => setActiveTab("current")}
                className={`py-3 text-xs font-extrabold rounded-xl border transition ${
                  activeTab === "current"
                    ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md"
                    : "bg-[#0b1830] text-slate-400 border-blue-950/70 hover:text-white"
                }`}
              >
                المشوار الحالي 🚖 {currentRide ? "(1)" : "(0)"}
              </button>
            </div>

            {/* المحتوى */}
            {activeTab === "available" ? (
              <div className="space-y-3 flex-1">
                {!isAvailable ? (
                  <div className="text-center py-8 bg-[#0b1830] border border-blue-950/70 rounded-2xl text-slate-500 text-xs font-medium">
                    أنت في وضع «مشغول / استراحة 🔴» — الطلبات الجديدة لن تُقبل منك.
                  </div>
                ) : availableRides.length === 0 ? (
                  <div className="text-center py-8 bg-[#0b1830] border border-blue-950/70 rounded-2xl text-slate-500 text-xs font-medium">
                    لا توجد طلبات قريبة حالياً. انتظر قليلاً... ⏳
                  </div>
                ) : (
                  availableRides.map((ride) => (
                    <div key={ride.id} className="bg-[#0b1830] border border-blue-900/70 rounded-2xl p-4 space-y-3 shadow-lg">
                      <div className="flex justify-between items-center text-xs border-b border-blue-950/70 pb-2.5">
                        <span className="font-bold text-white text-sm">👤 {ride.passengerName}</span>
                        <div className="flex items-center gap-1.5">
                          {ride.distanceKm !== null && ride.distanceKm !== undefined ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-bold text-[10px]">
                              📍 {ride.distanceKm < 1 ? `${Math.max(1, Math.round(ride.distanceKm * 1000))} م` : `${ride.distanceKm.toFixed(1)} كم`}
                            </span>
                          ) : null}
                          <span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 font-bold">
                            {serviceTypeLabel(ride.serviceType)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs space-y-1.5 text-slate-300">
                        <div>📍 من: <span className="text-white font-semibold">{ride.pickupLocation}</span></div>
                        <div>🏁 إلى: <span className="text-white font-semibold">{ride.destination}</span></div>
                        {ride.offeredPrice ? (
                          <div className="text-amber-400 font-bold font-mono text-sm">
                            💰 السعر المقترح: <span style={{ direction: "ltr", display: "inline-block" }}>{formatPrice(ride.offeredPrice)} ج.س</span>
                          </div>
                        ) : null}
                        <div className="text-slate-400 flex items-center justify-between pt-1">
                          <span>📞 الهاتف:</span>
                          <a
                            href={`tel:${ride.phoneNumber}`}
                            className="font-mono text-amber-400 hover:underline font-bold text-sm"
                            style={{ direction: "ltr" }}
                          >
                            {ride.phoneNumber}
                          </a>
                        </div>
                      </div>
                      <button
                        onClick={() => acceptRide(ride)}
                        disabled={!!currentRide || acceptingRef.current}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {currentRide ? "عندك مشوار حالي أولاً" : "قبول المشوار ✅"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {!currentRide ? (
                  <div className="text-center py-8 bg-[#0b1830] border border-blue-950/70 rounded-2xl text-slate-500 text-xs font-medium">
                    لا توجد رحلة حالية قيد التنفيذ.
                  </div>
                ) : (
                  <div className="bg-[#0b1830] border border-blue-900/70 rounded-2xl p-4 space-y-3.5 shadow-lg">
                    <div className="flex justify-between items-center text-xs border-b border-blue-950/70 pb-2.5">
                      <span className="font-bold text-emerald-400 text-sm">🟢 مشوار جاري (مشواري أنا)</span>
                      <span className="font-bold text-white text-sm">👤 {currentRide.passengerName}</span>
                    </div>
                    <div className="text-xs space-y-1.5 text-slate-300">
                      <div>📍 من: <span className="text-white font-semibold">{currentRide.pickupLocation}</span></div>
                      <div>🏁 إلى: <span className="text-white font-semibold">{currentRide.destination}</span></div>
                      {currentRide.offeredPrice ? (
                        <div className="text-amber-400 font-bold font-mono text-sm">
                          💰 السعر المقترح: <span style={{ direction: "ltr", display: "inline-block" }}>{formatPrice(currentRide.offeredPrice)} ج.س</span>
                        </div>
                      ) : null}
                      <div className="text-slate-400 flex items-center justify-between pt-1">
                        <span>📞 الهاتف:</span>
                        <a
                          href={`tel:${currentRide.phoneNumber}`}
                          className="font-mono text-amber-400 hover:underline font-bold text-sm"
                          style={{ direction: "ltr" }}
                        >
                          {currentRide.phoneNumber}
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={`tel:${currentRide.phoneNumber}`}
                        className="py-2.5 bg-[#122747] hover:bg-[#1a3564] text-slate-200 text-center text-xs font-bold rounded-xl border border-blue-900/60 transition"
                      >
                        اتصال بالزبون 📞
                      </a>
                      <a
                        href={`https://wa.me/${currentRide.phoneNumber.replace("+", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-center text-xs font-bold rounded-xl border border-emerald-500/30 transition"
                      >
                        واتساب 💬
                      </a>
                    </div>

                    <button
                      onClick={() => completeRide(currentRide.id)}
                      disabled={busy || acceptingRef.current}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition disabled:opacity-50"
                    >
                      إكمال / إنهاء المشوار 🏁
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
