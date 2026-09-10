"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageSquare, ShieldAlert, Navigation, Star, X } from "lucide-react";

export default function TrackRidePage() {
  const router = useRouter();
  const [rideStatus, setRideStatus] = useState<"on_way" | "arrived" | "in_transit">("on_way");
  const [eta, setEta] = useState(4); // الوقت المتبقي بالدقائق

  // محاكاة لحالة وصول الكابتن
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rideStatus === "on_way") {
        setRideStatus("arrived");
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [rideStatus]);

  // بيانات السائق افتراضية للتجربة
  const driver = {
    name: "عثمان أحمد",
    rating: 4.9,
    trips: 1240,
    vehicle: "ركشة توك توك - أحمر",
    plateNumber: "خ 2 - 4589",
    phone: "0912345678",
    avatar: "👨‍✈️",
  };

  return (
    <div className="relative h-screen w-full bg-[#121212] text-white flex flex-col justify-between overflow-hidden font-sans dir-rtl">
      
      {/* 1. Header with Emergency / Status */}
      <div className="absolute top-4 right-4 left-4 z-20 flex justify-between items-center">
        <button 
          onClick={() => router.push("/dashboard")}
          className="bg-[#1E1E1E]/90 backdrop-blur-md p-3 rounded-full border border-gray-800 text-gray-300 shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <button className="bg-red-500/20 text-red-400 border border-red-500/40 backdrop-blur-md px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg">
          <ShieldAlert className="w-4 h-4" />
          طوارئ (SOS)
        </button>
      </div>

      {/* 2. Map View Placeholder */}
      <div className="absolute inset-0 z-0 bg-[#0c1017] flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-[#1E293B_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
        
        {/* Animated Driver Pin on Map */}
        <div className="relative flex flex-col items-center animate-bounce">
          <div className="bg-amber-500 text-black px-3 py-1 rounded-full text-xs font-bold shadow-xl border border-black mb-1 flex items-center gap-1">
            <span>{driver.name}</span>
            <span>🛺</span>
          </div>
          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold shadow-2xl">
            <Navigation className="w-5 h-5 fill-current rotate-45" />
          </div>
        </div>
      </div>

      {/* 3. Bottom Driver Info Card */}
      <div className="relative z-10 mt-auto bg-[#1E1E1E] border-t border-gray-800 rounded-t-3xl p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-300">
        
        {/* Drag Line */}
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto -mt-2"></div>

        {/* Status Indicator Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-center">
          {rideStatus === "on_way" && (
            <p className="text-sm font-bold text-amber-400">
              الكابتن في الطريق إليك (يصل خلال {eta} دقائق) ⏱️
            </p>
          )}
          {rideStatus === "arrived" && (
            <p className="text-sm font-bold text-emerald-400">
              وصل الكابتن إلى موقعك الآن! 🛺✨
            </p>
          )}
          {rideStatus === "in_transit" && (
            <p className="text-sm font-bold text-blue-400">
              الرحلة قيد التنفيذ - نتمنى لك رحلة آمنة 🛣️
            </p>
          )}
        </div>

        {/* Driver Profile & Vehicle Info */}
        <div className="flex items-center justify-between bg-[#121212] p-4 rounded-2xl border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-3xl border border-gray-700">
              {driver.avatar}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{driver.name}</h3>
              <div className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="font-bold">{driver.rating}</span>
                <span className="text-gray-500">({driver.trips} رحلة)</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{driver.vehicle}</p>
            </div>
          </div>

          {/* License Plate Badge */}
          <div className="bg-amber-500 text-black px-3 py-1.5 rounded-xl font-mono text-xs font-black border border-amber-400 tracking-wider">
            {driver.plateNumber}
          </div>
        </div>

        {/* Quick Actions (Call & Chat) */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${driver.phone}`}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl transition shadow-lg"
          >
            <Phone className="w-4 h-4 fill-current" />
            <span>اتصال محلي</span>
          </a>

          <button 
            onClick={() => alert("سيتم فتح الدردشة فوراً")}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-3.5 rounded-2xl border border-gray-700 transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>مراسلة</span>
          </button>
        </div>

        {/* Cancel Ride Button */}
        <button 
          onClick={() => {
            if (confirm("هل أنت تأكد من إلغاء الرحلة؟")) {
              router.push("/dashboard");
            }
          }}
          className="w-full text-center text-red-400 hover:text-red-300 text-xs font-semibold py-1 transition"
        >
          إلغاء الرحلة
        </button>

      </div>
    </div>
  );
}
