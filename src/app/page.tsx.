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
      
