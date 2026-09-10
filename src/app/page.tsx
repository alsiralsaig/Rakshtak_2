"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Map from "@/components/Map";
import {
  normalizeSudanesePhone,
  formatPrice,
  formatCountdown,
} from "@/lib/format";
import { SERVICE_TYPES } from "@/lib/constants";

/** مهلة البحث بالثواني */
const SEARCH_TIMEOUT_SECONDS = 120;
/** نسبة زيادة السعر */
const PRICE_RAISE_RATIO = 0.2;
/** فترة استطلاع حالة الرحلة (بعد تفعيل RLS في المرحلة 3) */
const POLL_MS = 4000;

/* ════════════════════════════════════════════════════════════════
 * صفحة الراكب — المرحلة 3:
 * كل العمليات عبر مسارات الخادم (لا وصول مباشر لـ Supabase من المتصفح):
 * POST /api/rides (إنشاء) ثم GET /api/rides/[id] باستطلاع دوري
 * وcancel/raise عبر المسارات — مع رمز راكب (riderToken) في localStorage.
 * ════════════════════════════════════════════════════════════════ */

interface RideState {
  id: number | string;
  status: string;
  serviceType: string;
  pickupLocation: string;
  destination: string;
  offeredPrice: number | null;
  driverId: number | null;
  driverPhone: string | null;
  createdAt: string | null;
}

const RIDE_ID_KEY = "active_ride_id";
const RIDE_TOKEN_KEY = "rider_token";

export default function PassengerHome() {
  const [passengerName, setPassengerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [serviceType, setServiceType] = useState("ركشة ركاب");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<RideState | null>(null);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);

  const [searchSecondsLeft, setSearchSecondsLeft] = useState(SEARCH_TIMEOUT_SECONDS);
  const [searchTimedOut, setSearchTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  const [riderToken, setRiderToken] = useState<string | null>(null);

  const clearSearchTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** استطلاع حالة الرحلة من الخادم */
  const pollRide = useCallback(async () => {
    if (!rideId || !riderToken) return;
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        headers: { "x-rider-token": riderToken },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (res.status === 404 || res.status === 403) {
          localStorage.removeItem(RIDE_ID_KEY);
          localStorage.removeItem(RIDE_TOKEN_KEY);
          setRideId(null);
          setRiderToken(null);
          setActiveRide(null);
        }
        return;
      }
      const ride = data.ride as RideState;
      setActiveRide(ride);
      if (ride.status === "cancelled") {
        localStorage.removeItem(RIDE_ID_KEY);
        localStorage.removeItem(RIDE_TOKEN_KEY);
      }
    } catch {
      /* تجاهل أخطاء الشبكة المؤقتة */
    }
  }, [rideId, riderToken]);

  // 1) استرجاع الجلسة عند فتح الصفحة
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedName = localStorage.getItem("passenger_name");
    const savedPhone = localStorage.getItem("passenger_phone");
    const savedRideId = localStorage.getItem(RIDE_ID_KEY);
    const savedToken = localStorage.getItem(RIDE_TOKEN_KEY);

    if (savedName) setPassengerName(savedName);
    if (savedPhone) {
      const norm = normalizeSudanesePhone(savedPhone);
      setPhoneNumber(norm ? norm.replace("+249", "") : savedPhone.replace(/\D/g, ""));
    }
    if (savedRideId && savedToken) {
      setRideId(savedRideId);
      setRiderToken(savedToken);
    }
  }, []);

  // 2) استطلاع دوري كلما وُجدت رحلة
  useEffect(() => {
    if (!rideId || !riderToken) return;
    void pollRide();
    pollRef.current = setInterval(pollRide, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [rideId, riderToken, pollRide]);

  // 3) عدّاد مهلة البحث
  useEffect(() => {
    if (activeRide?.status !== "pending") {
      clearSearchTimer();
      setSearchSecondsLeft(SEARCH_TIMEOUT_SECONDS);
      setSearchTimedOut(false);
      return;
    }
    setSearchSecondsLeft(SEARCH_TIMEOUT_SECONDS);
    setSearchTimedOut(false);
    timerRef.current = setInterval(() => {
      setSearchSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setSearchTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearSearchTimer;
  }, [activeRide?.id, activeRide?.status, clearSearchTimer]);

  useEffect(() => clearSearchTimer, [clearSearchTimer]);

  /** رفع السعر 20% عبر الخادم */
  const handleRaisePrice = async () => {
    if (!rideId || !riderToken || activeRide?.status !== "pending") return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rides/${rideId}/raise`, {
        method: "POST",
        headers: { "x-rider-token": riderToken },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setActiveRide((prev) => (prev ? { ...prev, offeredPrice: data.price } : prev));
        setSearchSecondsLeft(SEARCH_TIMEOUT_SECONDS);
        setSearchTimedOut(false);
        alert(`تم رفع السعر المقترح إلى ${formatPrice(data.price)} ج.س`);
      } else {
        alert(data.error || "تعذر رفع السعر");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = passengerName.trim().replace(/\s+/g, " ");
    const cleanPickup = pickupLocation.trim();
    const cleanDestination = destination.trim();
    if (!cleanName || !cleanPickup || !cleanDestination) {
      setErrorMsg("فضلاً املأ الاسم ومكان التحرك والوجهة");
      return;
    }

    const fullPhone = normalizeSudanesePhone(phoneNumber);
    if (!fullPhone) {
      setErrorMsg("رقم الهاتف غير صحيح — أدخل 9 أرقام سودانية تبدأ بـ 9 (مثال: 0912345678)");
      return;
    }

    const numericPrice = offeredPrice.trim() === "" ? null : Number(offeredPrice);
    if (numericPrice !== null && (!Number.isFinite(numericPrice) || numericPrice < 0)) {
      setErrorMsg("السعر المقترح غير صحيح — أدخل مبلغاً موجباً أو اتركه فارغاً");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerName: cleanName,
          phone: fullPhone,
          pickupLocation: cleanPickup,
          destination: cleanDestination,
          offeredPrice: numericPrice,
          serviceType,
          pickupLat: pickupCoords ? pickupCoords[0] : null,
          pickupLng: pickupCoords ? pickupCoords[1] : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "حدث خطأ أثناء إرسال الطلب");
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("passenger_name", cleanName);
        localStorage.setItem("passenger_phone", fullPhone);
        localStorage.setItem(RIDE_ID_KEY, String(data.ride.id));
        localStorage.setItem(RIDE_TOKEN_KEY, data.riderToken);
      }
      setRideId(String(data.ride.id));
      setRiderToken(data.riderToken);
      setActiveRide(data.ride as RideState);
      setErrorMsg(null);
    } catch {
      setErrorMsg("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  /** إلغاء عبر الخادم (برمز الراكب) */
  const handleStartNewRide = async () => {
    if (!activeRide) return;

    if (activeRide.status === "pending" || activeRide.status === "accepted") {
      if (!rideId || !riderToken) return;
      const ok = window.confirm("متأكد إنك تبي تلغي المشوار؟");
      if (!ok) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/rides/${rideId}/cancel`, {
          method: "POST",
          headers: { "x-rider-token": riderToken },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          alert(data.error || "تعذر إلغاء الطلب — جرب تاني");
          return;
        }
      } catch {
        alert("تعذر إلغاء الطلب — جرب تاني");
        return;
      } finally {
        setLoading(false);
      }
    }

    localStorage.removeItem(RIDE_ID_KEY);
    localStorage.removeItem(RIDE_TOKEN_KEY);
    setRideId(null);
    setRiderToken(null);
    setActiveRide(null);
    setSearchSecondsLeft(SEARCH_TIMEOUT_SECONDS);
    setSearchTimedOut(false);
  };

  const formattedPrice = formatPrice(activeRide?.offeredPrice);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050b1a] via-[#0a1830] to-[#102a52] text-slate-100 p-4 flex flex-col justify-between w-full min-w-full">
      <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-between space-y-5">
        {/* الشريط العلوي */}
        <header className="flex justify-between items-center pt-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛺</span>
            <span className="font-extrabold text-xl text-white tracking-wide">رَكْشَتُك</span>
          </div>

          <button
            type="button"
            onClick={() => { window.location.href = "/driver"; }}
            className="bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-400 font-bold text-sm px-4 py-2.5 rounded-xl border border-amber-500/30 transition flex items-center gap-2 shadow-lg"
          >
            <span>🚖</span> لوحة السائق
          </button>
        </header>

        {/* الخريطة */}
        <div className="w-full h-52 rounded-2xl overflow-hidden border border-blue-900/40 shadow-xl shrink-0">
          <Map
            pickupName={pickupLocation || "موقعي الحالي"}
            interactive
            onLocationSelect={(coords, name) => {
              setPickupCoords(coords);
              if (name) setPickupLocation(name);
            }}
          />
        </div>

        {/* النموذج أو حالة الطلب */}
        {!activeRide ? (
          <form onSubmit={handleCreateRide} className="space-y-4 flex-1 flex flex-col justify-center">
            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
                ⚠️ {errorMsg}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">الاسم:</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="اسمك الكريم"
                  className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">نوع الخدمة:</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3 py-3 text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.icon} {s.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9XXXXXXXX"
                  className="w-full bg-transparent px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none font-mono text-left"
                  style={{ direction: 'ltr' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">📍 مكان التحرك:</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="دوس على الخريطة أو اكتب المكان"
                  className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">🏁 الوجهة:</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="مثال: حي المطار"
                  className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block text-right">💰 السعر المقترح (ج.س):</label>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
                placeholder="أدخل المبلغ المقترح"
                className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none font-mono text-right focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold rounded-2xl text-base shadow-xl transition mt-2 disabled:opacity-50"
            >
              {loading ? "جاري الإرسال..." : "طلب المشوار الآن 🚀"}
            </button>
          </form>
        ) : (
          <div className="bg-[#0b1830] border border-blue-900/60 rounded-2xl p-5 space-y-4 my-auto shadow-2xl">
            {activeRide.status === "pending" ? (
              <div className="text-center space-y-3">
                <span className="text-3xl animate-bounce inline-block">⏳</span>
                <h3 className="text-base font-bold text-amber-400">جاري البحث عن سائق...</h3>
                <p className="text-xs text-slate-400">تم نشر مشوارك للسائقين القريبين منك، يرجى الانتظار</p>

                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${
                    searchTimedOut
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-[#122747]/60 text-slate-300 border-blue-900/60"
                  }`}
                >
                  ⏱️ {searchTimedOut ? "انتهت المهلة" : `المتبقي ${formatCountdown(searchSecondsLeft)}`}
                </div>

                {searchTimedOut && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs text-amber-200 leading-relaxed">
                    لسه ما في سائق قبِل مشوارك. تقدر تزوّد السعر المقترح ٢٠٪
                    عشان تجذب سائق أسرع، أو تلغي الطلب.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRaisePrice}
                  disabled={loading}
                  className="w-full py-3 bg-amber-500/15 hover:bg-amber-500/25 active:scale-[0.99] text-amber-400 border border-amber-500/30 font-extrabold text-xs rounded-xl transition disabled:opacity-50"
                >
                  🔥 زوّد السعر ٢٠٪
                  {formattedPrice
                    ? ` (يصير ${formatPrice(Math.round(Number(activeRide.offeredPrice) * 1.2))} ج.س)`
                    : ""}
                </button>
              </div>
            ) : activeRide.status === "accepted" ? (
              <div className="text-center space-y-2">
                <span className="text-3xl inline-block">🎉</span>
                <h3 className="text-base font-bold text-emerald-400">تم قبول طلبك! السائق في الطريق إليك</h3>
                {activeRide.driverPhone && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-400 mb-1">رقم هاتف السائق:</p>
                    <a
                      href={`tel:${activeRide.driverPhone}`}
                      className="inline-block py-2.5 px-5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-mono font-bold text-sm rounded-xl border border-emerald-500/30 transition"
                      style={{ direction: "ltr" }}
                    >
                      📞 {activeRide.driverPhone}
                    </a>
                  </div>
                )}
              </div>
            ) : activeRide.status === "completed" ? (
              <div className="text-center space-y-3 py-2">
                <div className="text-5xl animate-bounce">🏁 🏁</div>
                <h3 className="text-xl font-extrabold text-amber-400">الحمد لله على السلامة! 🎉</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  تم إكمال المشوار ووصولك إلى وجهتك بنجاح ✨
                </p>
              </div>
            ) : (
              <div className="text-center space-y-3 py-2">
                <div className="text-4xl">🚫</div>
                <h3 className="text-base font-bold text-red-400">تم إلغاء المشوار</h3>
                <p className="text-xs text-slate-300">تقدر تطلب مشوار جديد في أي وقت.</p>
              </div>
            )}

            <div className="text-xs space-y-2 border-t border-b border-blue-950/70 py-3 text-slate-300">
              <div>📍 <strong>من:</strong> {activeRide.pickupLocation}</div>
              <div>🏁 <strong>إلى:</strong> {activeRide.destination}</div>
              {formattedPrice && (
                <div>💰 <strong>السعر:</strong> <span className="font-mono font-bold text-amber-400">{formattedPrice} ج.س</span></div>
              )}
            </div>

            <button
              onClick={handleStartNewRide}
              className={`w-full py-3.5 font-extrabold text-xs rounded-xl transition shadow-lg ${
                activeRide.status === "completed"
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
              }`}
            >
              {activeRide.status === "completed" || activeRide.status === "cancelled"
                ? "طلب مشوار جديد 🚀"
                : "إلغاء الطلب"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
