"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SearchingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "ride";
  const pickup = searchParams.get("pickup") || "";
  const destination = searchParams.get("destination") || "";

  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const isRide = type === "ride";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6 animate-pulse">
          {isRide ? "🚖" : "📦"}
        </div>

        <h1 className="text-2xl font-bold mb-2">
          جاري البحث عن سائق{dots}
        </h1>

        <p className="text-gray-400 mb-8">
          {isRide ? "سيتم توصيلك في أقرب وقت" : "سيتم استلام شحنتك في أقرب وقت"}
        </p>

        <div className="bg-gray-900 rounded-2xl p-5 text-right">
          <div className="flex justify-between mb-3">
            <span className="text-gray-400">من</span>
            <span className="font-semibold">{pickup}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">إلى</span>
            <span className="font-semibold">{destination}</span>
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          className="mt-10 text-gray-500 underline"
        >
          إلغاء
        </button>
      </div>
    </main>
  );
}

export default function SearchingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SearchingScreen />
    </Suspense>
  );
}
