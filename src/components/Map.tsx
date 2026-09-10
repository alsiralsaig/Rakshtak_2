"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";

interface MapProps {
  center?: [number, number];
  pickupName?: string;
  onLocationSelect?: (coords: [number, number], name?: string) => void;
  interactive?: boolean;
}

/** جلب اسم المنطقة من الإحداثيات (مجاني بدون مفتاح — Nominatim) */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=ar`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    const a = j?.address ?? {};
    return (
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.city_district ||
      a.town ||
      a.village ||
      a.city ||
      (typeof j?.display_name === "string" ? j.display_name.split(",")[0] : null) ||
      null
    );
  } catch {
    return null;
  }
}

export default function Map({
  center = [15.5007, 32.5599],
  pickupName,
  onLocationSelect,
  interactive = false,
}: MapProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const cbRef = useRef(onLocationSelect);
  cbRef.current = onLocationSelect;

  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  const placeMarker = useCallback((lat: number, lng: number, fly = true) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "rk-pin-wrap",
        html: `<div class="rk-pin"><span></span></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 40],
      });
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (fly) map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
  }, []);

  const pickAt = useCallback(
    async (lat: number, lng: number) => {
      placeMarker(lat, lng);
      const name = await reverseGeocode(lat, lng);
      if (name) setResolvedName(name);
      cbRef.current?.([lat, lng], name ?? undefined);
    },
    [placeMarker]
  );

  const locateNow = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("متصفحك ما بيدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pickAt(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "إذن الموقع مرفوض — فعّله من إعدادات المتصفح أو دوس على الخريطة"
            : "تعذر جلب موقعك دلوقتي — حدد مكانه من الخريطة"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [pickAt]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !boxRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(boxRef.current, {
        center,
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
      });
      // بلاطات داكنة مجانية بدون مفتاح (Esri Dark Gray Canvas)
      const dark = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        { attribution: "&copy; Esri &copy; OpenStreetMap contributors", maxZoom: 19 }
      );
      const darkLabels = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.9 }
      );
      dark.addTo(map);
      darkLabels.addTo(map);
      // احتياطي: لو بلاطات Esri فشلت نرجع لأوسم مع فلتر داكن
      dark.on("tileerror", () => {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);
        map.getContainer().classList.add("rk-map-light");
      });
      mapRef.current = map;
      map.on("click", (e: any) => {
        if (!interactive) return;
        pickAt(e.latlng.lat, e.latlng.lng);
      });
      locateNow();
    })();
    return () => {
      dead = true;
      mapRef.current?.remove?.();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = pickupName || resolvedName || "موقعي الحالي";

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-blue-950/70 bg-[#08132a]">
      <div ref={boxRef} className="absolute inset-0 z-0" />

      {interactive && (
        <div className="absolute top-2 right-2 left-2 z-[500] pointer-events-none flex justify-center">
          <span className="bg-[#0f2347]/90 backdrop-blur-md text-slate-200 text-[11px] px-3 py-1.5 rounded-full border border-blue-900/50 shadow-lg">
            📍 دوس على الخريطة لتحديد مكانك بالضبط
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={locateNow}
        disabled={locating}
        className="absolute top-2 left-2 z-[500] bg-[#0f2347]/90 hover:bg-[#1a3564] text-white px-2.5 py-2 rounded-xl border border-blue-900/60 shadow-xl backdrop-blur-md flex items-center gap-1.5 text-[11px] active:scale-95 transition-all"
      >
        <span className={locating ? "animate-spin" : ""}>📍</span>
        <span>{locating ? "جاري التحديد..." : "موقعي الحالي"}</span>
      </button>

      {gpsError && (
        <div className="absolute bottom-14 right-2 left-2 z-[500] bg-red-900/80 text-red-100 text-[11px] p-2 rounded-xl border border-red-700/50 backdrop-blur-md">
          ⚠️ {gpsError}
        </div>
      )}

      <div className="absolute bottom-2 right-2 left-2 z-[500] bg-[#0f2347]/90 backdrop-blur-md border border-blue-950/70 p-2 rounded-xl flex items-center justify-between text-[12px] text-white shadow-lg pointer-events-none">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <strong className="text-amber-400 truncate">{label}</strong>
        </span>
        <span className="text-[10px] text-slate-500 shrink-0">🛺 ركشتك</span>
      </div>
    </div>
  );
}
