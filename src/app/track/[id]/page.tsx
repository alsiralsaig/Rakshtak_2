"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Ride {
  id: number;
  pickupLocation: string;
  destination: string;
  status: string;
  driverLat?: number;
  driverLng?: number;
  driverId?: string;
  customerName?: string;
}

export default function TrackPage() {
  const params = useParams();
  const rideId = params.id;
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rideId) return;

    const fetchRide = async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}`);
        if (!res.ok) throw new Error("الرحلة غير موجودة");
        const data = await res.json();
        setRide(data);
      } catch (err: any) {
        setError(err.message || "حدث خطأ");
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
    const interval = setInterval(fetchRide, 5000); // تحديث كل 5 ثواني
    return () => clearInterval(interval);
  }, [rideId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">⏳ جاري تحميل موقع الرحلة...</p>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-xl">❌ {error || "الرحلة غير موجودة"}</p>
      </div>
    );
  }

  const hasLocation = ride.driverLat && ride.driverLng;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">🚗 تتبع الرحلة</h1>
        <p className="text-gray-400 text-center mb-6">
          راكب: {ride.customerName || "مسافر"} | السائق: {ride.driverId || "لم يتم تعيينه بعد"}
        </p>

        <div className="bg-gray-800 rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">📍 نقطة الانطلاق</p>
              <p className="text-lg font-semibold">{ride.pickupLocation}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">🏁 الوجهة</p>
              <p className="text-lg font-semibold">{ride.destination}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 text-sm">📌 حالة الرحلة</p>
            <p className={`text-lg font-bold ${
              ride.status === "accepted" ? "text-green-400" :
              ride.status === "searching" ? "text-yellow-400" :
              ride.status === "completed" ? "text-blue-400" :
              ride.status === "cancelled" ? "text-red-400" :
              "text-gray-400"
            }`}>
              {ride.status === "accepted" ? "✅ السائق في الطريق" :
               ride.status === "searching" ? "⏳ جاري البحث عن سائق" :
               ride.status === "completed" ? "✔️ الرحلة منتهية" :
               ride.status === "cancelled" ? "❌ الرحلة ملغاة" :
               ride.status}
            </p>
          </div>
        </div>

        {/* ===== الخريطة ===== */}
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
          <iframe
            width="100%"
            height="400"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${hasLocation ? (ride.driverLng! - 0.02) + ',' + (ride.driverLat! - 0.02) + ',' + (ride.driverLng! + 0.02) + ',' + (ride.driverLat! + 0.02) : '32.5,15.5,33.0,16.0'}&layer=mapnik&marker=${hasLocation ? ride.driverLat + ',' + ride.driverLng : '15.5,32.5'}`}
            title="خريطة تتبع الرحلة"
          ></iframe>
          <div className="bg-gray-800 p-3 text-center text-sm text-gray-400">
            {hasLocation ? (
              <span>📍 موقع السائق الحالي: {ride.driverLat}, {ride.driverLng}</span>
            ) : (
              <span>⏳ لم يشارك السائق موقعه بعد</span>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>🔗 رابط التتبع: <span className="text-blue-400">{window.location.href}</span></p>
          <p className="mt-2">يمكنك مشاركة هذا الرابط مع أي شخص لمتابعة الرحلة</p>
        </div>
      </div>
    </div>
  );
}
