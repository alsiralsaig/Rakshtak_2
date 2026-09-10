"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "ride";

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRide = type === "ride";

  const handleSubmit = async () => {
    if (!pickup || !destination) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: type,
          pickupLocation: pickup,
          destination: destination,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ");
      }

      router.push(
        `/searching?rideId=${data.ride.id}&type=${type}&pickup=${encodeURIComponent(
          pickup
        )}&destination=${encodeURIComponent(destination)}`
      );
    } catch (err) {
      setError("حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col px-6 py-8">
      <button
        onClick={() => router.back()}
        className="text-gray-400 mb-6 text-right w-fit"
      >
        ← رجوع
      </button>

      <div className="w-full max-w-sm mx-auto flex-1">
        <h1 className="text-2xl font-bold mb-1 text-center">
          {isRide ? "🚖 تفاصيل المشوار" : "📦 تفاصيل نقل البضاعة"}
        </h1>
        <p className="text-gray-400 text-center mb-8">
          {isRide ? "حدد نقطة الانطلاق والوجهة" : "حدد مكان الاستلام والتسليم"}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {isRide ? "من (نقطة الانطلاق)" : "من (مكان الاستلام)"}
            </label>
            <input
              type="text"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="مثال: السوق الكبير، عطبرة"
              className="w-full py-4 px-4 rounded-xl bg-gray-900 border-2 border-gray-700 text-white placeholder-gray-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {isRide ? "إلى (الوجهة)" : "إلى (مكان التسليم)"}
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="مثال: الجامعة، عطبرة"
              className="w-full py-4 px-4 rounded-xl bg-gray-900 border-2 border-gray-700 text-white placeholder-gray-500 focus:border-orange-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mt-4">{error}</p>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!pickup || !destination || loading}
        className="w-full max-w-sm mx-auto py-4 rounded-xl bg-orange-500 text-white font-bold text-lg disabled:opacity-40 disabled:bg-gray-700"
      >
        {loading ? "جاري الإرسال..." : "بحث عن سائق"}
      </button>
    </main>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <RequestForm />
    </Suspense>
  );
}
