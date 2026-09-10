"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Camera, ArrowRight, ShieldCheck } from "lucide-react";

export default function SetupProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // إظهار نافذة إشعار الخصوصية مثل تطبيق ترحال قبل التوجيه للرئيسية
    setShowPrivacyModal(true);
  };

  const handleAcceptPrivacy = () => {
    setLoading(true);
    // التوجيه الشاشة الرئيسية للطلب والخريطة
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col justify-between p-6 dir-rtl font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <button 
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <button 
          onClick={handleSave}
          disabled={!name.trim()}
          className={`text-sm font-semibold ${name.trim() ? "text-amber-500" : "text-gray-600"}`}
        >
          حفظ
        </button>
      </div>

      {/* Main Content */}
      <div className="my-auto max-w-md w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-right">
            أضف بعض المعلومات الشخصية
          </h1>
        </div>

        {/* Profile Picture Upload */}
        <div className="flex items-center justify-between bg-[#1E1E1E] p-4 rounded-xl border border-gray-800">
          <span className="text-gray-300 font-medium">إضافة صورة</span>
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-700">
              <User className="w-8 h-8" />
            </div>
            <button className="absolute bottom-0 left-0 bg-amber-500 p-1.5 rounded-full text-black">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Input Fields */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-1 text-right">
            <label className="text-xs text-amber-500 font-medium block">الاسم</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: تاج السر حسن"
              className="w-full bg-transparent border-b border-amber-500 py-2 text-lg text-white focus:outline-none transition"
              required
            />
          </div>

          <div className="space-y-1 text-right">
            <label className="text-xs text-gray-400 font-medium block">رمز الإحالة إن وجد</label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="أدخل الرمز هنا"
              className="w-full bg-transparent border-b border-gray-700 py-2 text-lg text-white focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </form>

        <div className="pt-8 text-center">
          <button 
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-red-400 text-sm font-medium transition"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Privacy Modal (شاشة إشعار الخصوصية من ترحال) */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-[#1E1E1E] w-full max-w-sm rounded-3xl p-6 text-center space-y-6 border border-gray-800 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">إشعار الخصوصية</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                يجمع تطبيق <span className="text-amber-500 font-semibold">ركشتك</span> بيانات الموقع لتفعيل تتبع مسارك خلال الرحلة فقط، حتى عندما يكون التطبيق مغلقاً أو غير مستخدم.
              </p>
            </div>

            <button
              onClick={handleAcceptPrivacy}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3.5 rounded-2xl transition duration-200"
            >
              {loading ? "جاري التجهيز..." : "موافق"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
