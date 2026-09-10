"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Phone, 
  Wallet, 
  PlusCircle, 
  MapPin, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  ChevronLeft,
  ArrowRight
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  
  // بيانات مستخدم افتراضية للتجربة
  const [userProfile, setUserProfile] = useState({
    fullName: "أحمد عبد الله",
    phone: "0912345678",
    email: "ahmed@example.com",
    walletBalance: "4,500",
  });

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
        <h1 className="text-base font-bold text-white">الملف الشخصي والمحفظة</h1>
        <div className="w-9"></div> {/* Spacer for symmetry */}
      </div>

      <div className="p-4 space-y-5 max-w-md mx-auto w-full">
        
        {/* 2. User Basic Info Card */}
        <div className="bg-[#1E1E1E] p-5 rounded-3xl border border-gray-800 flex items-center gap-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-3xl">
            👤
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">{userProfile.fullName}</h2>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-amber-500" />
              {userProfile.phone}
            </p>
            <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
              حساب موثق
            </span>
          </div>
        </div>

        {/* 3. Wallet Card */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-black p-5 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute -left-4 -bottom-4 opacity-10 text-8xl">
            💳
          </div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-black/70">رصيد محفظة ركشتك</p>
              <h3 className="text-2xl font-black mt-1">
                {userProfile.walletBalance} <span className="text-xs font-bold">ج.س</span>
              </h3>
            </div>
            <div className="p-2.5 bg-black/10 rounded-2xl">
              <Wallet className="w-6 h-6 text-black" />
            </div>
          </div>

          <button 
            onClick={() => alert("سيتم فتح بوابة شحن المحفظة (بنكك / أوكاش)")}
            className="w-full bg-black text-white hover:bg-gray-900 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            شحن المحفظة الآن
          </button>
        </div>

        {/* 4. Quick Settings & Options */}
        <div className="bg-[#1E1E1E] rounded-3xl border border-gray-800 divide-y divide-gray-800/60 overflow-hidden shadow-xl">
          
          {/* Saved Places */}
          <button 
            onClick={() => alert("الأماكن المفضلة")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-800/40 transition text-right"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">الأماكن المفضلة</p>
                <p className="text-[11px] text-gray-400">المنزل، العمل، والعناوين الشائعة</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>

          {/* Privacy & Safety */}
          <button 
            onClick={() => alert("الأمان والخصوصية")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-800/40 transition text-right"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">الأمان والخصوصية</p>
                <p className="text-[11px] text-gray-400">تغيير كلمة المرور وتوثيق الحساب</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>

          {/* Help & Support */}
          <button 
            onClick={() => alert("الدعم الفني")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-800/40 transition text-right"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">المساعدة والدعم</p>
                <p className="text-[11px] text-gray-400">الأسئلة الشائعة والتواصل مع خدمة العملاء</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>

        </div>

        {/* Logout Button */}
        <button 
          onClick={() => {
            if (confirm("هل تريد تسجيل الخروج؟")) {
              router.push("/login");
            }
          }}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>

      </div>
    </div>
  );
}
