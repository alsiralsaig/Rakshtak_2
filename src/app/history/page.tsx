"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  Clock, 
  MapPin, 
  Star, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft 
} from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();

  // قائمة رحلات افتراضية للعرض
  const [rides, setRides] = useState([
    {
      id: "1",
      date: "اليوم - 02:30 م",
      driverName: "عثمان أحمد",
      vehicle: "ركشة",
      pickup: "السوق الشعبي",
      destination: "حي العمدة - المحطة 4",
      fare: "1,500",
      status: "completed",
      rating: 5,
    },
    {
      id: "2",
      date: "أمس - 07:15 م",
      driverName: "محمد حسن",
      vehicle: "توك توك مغلق",
      pickup: "موقف بحري",
      destination: "مستشفى الموردة",
      fare: "2,000",
      status: "completed",
      rating: 4,
    },
    {
      id: "3",
      date: "20 يوليو - 11:00 ص",
      driverName: "علي البشير",
      vehicle: "موتر توصيل",
      pickup: "السوق العربي",
      destination: "شارع النيل",
      fare: "1,000",
      status: "cancelled",
      rating: 0,
    },
  ]);

  return (
    <div className="min-h-screen w-full bg-[#121212] text-white flex flex-col font-sans dir-rtl pb-10">
      
      {/* 1. Header Navigation */}
      <div className="p-4 flex items-center justify-between border-b border-gray-800 bg-[#1E1E1E]">
        <button 
          onClick={() => router.push("/dashboard")}
          className="p-2 bg-gray-800 rounded-xl text-gray-300 hover:text-white transition"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-white">سجل الرحلات</h1>
        <div className="w-9"></div> {/* Spacer for symmetry */}
      </div>

      {/* 2. Rides List */}
      <div className="p-4 space-y-4 max-w-md mx-auto w-full">
        {rides.map((ride) => (
          <div 
            key={ride.id} 
            className="bg-[#1E1E1E] border border-gray-800 rounded-3xl p-5 space-y-4 shadow-xl hover:border-gray-700 transition"
          >
            {/* Top Info */}
            <div className="flex justify-between items-center border-b border-gray-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛺</span>
                <div>
                  <h3 className="text-sm font-bold text-white">{ride.driverName}</h3>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {ride.date}
                  </p>
                </div>
              </div>

              {ride.status === "completed" ? (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> مكتملة
                </span>
              ) : (
                <span className="bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> ملغاة
                </span>
              )}
            </div>

            {/* Route */}
            <div className="bg-[#121212] p-3 rounded-2xl border border-gray-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></div>
                <p className="text-gray-300 truncate"><span className="text-gray-500">من:</span> {ride.pickup}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-amber-500 rounded-sm shrink-0"></div>
                <p className="text-gray-300 truncate"><span className="text-gray-500">إلى:</span> {ride.destination}</p>
              </div>
            </div>

            {/* Bottom Fare & Rating */}
            <div className="flex justify-between items-center pt-1">
              <div>
                <p className="text-[10px] text-gray-400">التكلفة</p>
                <p className="text-base font-extrabold text-amber-400">{ride.fare} <span className="text-[10px]">ج.س</span></p>
              </div>

              {ride.status === "completed" && (
                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                  <span className="text-xs font-bold text-amber-400">{ride.rating}.0</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
