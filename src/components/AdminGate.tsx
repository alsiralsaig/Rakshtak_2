"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";

/** مفتاح التخزين المحلي لرمز الإدارة */
export const ADMIN_TOKEN_KEY = "rakshtak_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
  } catch {
    /* التخزين غير متاح */
  }
}

export function clearAdminToken(): void {
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* تجاهل */
  }
}

/**
 * تحقق الخادم من رمز الإدارة (يقارنه بـ RAKSHTAK_ADMIN_TOKEN على الخادم)
 * — البوابة لا تفتح إلا برمز صحيح فعلاً.
 */
async function verifyAdminToken(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error || "رمز الإدارة غير صحيح" };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم للتحقق من الرمز" };
  }
}

/**
 * بوابة إدارية لصفحة /admin:
 * تطلب رمز RAKSHTAK_ADMIN_TOKEN، يتحقق منه الخادم (POST /api/admin/verify)
 * ثم يُحفظ في sessionStorage (يزول بإغلاق التبويب).
 */
export default function AdminGate({
  children,
  title = "بوابة الإدارة",
}: {
  children: ReactNode;
  title?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const unlock = (value: string) => {
    setAdminToken(value);
    setToken(value);
    setGateError(null);
  };

  // عند التحميل: إن وُجد رمز مخزّن، تأكد منه في الخلفية (فشل ← ارجع للقفل)
  useEffect(() => {
    const saved = getAdminToken();
    if (!saved) {
      setReady(true);
      return;
    }
    setVerifying(true);
    verifyAdminToken(saved).then((res) => {
      if (res.ok) {
        unlock(saved);
      } else {
        clearAdminToken();
        setGateError(res.error || "الجلسة غير صالحة");
      }
      setVerifying(false);
      setReady(true);
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value || verifying) return;
    setVerifying(true);
    setGateError(null);
    const res = await verifyAdminToken(value);
    setVerifying(false);
    if (res.ok) {
      unlock(value);
      setInput("");
    } else {
      setGateError(res.error || "رمز الإدارة غير صحيح");
    }
  };

  if (!ready || verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050b1a] via-[#0a1830] to-[#102a52] flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">جاري التحقق...</div>
      </div>
    );
  }

  if (token) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050b1a] via-[#0a1830] to-[#102a52] text-slate-100 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-[#0f2347] border border-blue-950/70 rounded-3xl p-6 space-y-4 shadow-2xl"
      >
        <div className="text-center space-y-1.5">
          <div className="text-4xl">🔐</div>
          <h1 className="text-lg font-extrabold text-white">{title}</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            هذه الصفحة إدارية ومقفولة. أدخل رمز الإدارة
            (RAKSHTAK_ADMIN_TOKEN) للمتابعة.
          </p>
        </div>

        <input
          type="password"
          autoFocus
          required
          disabled={verifying}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="رمز الإدارة"
          className="w-full bg-[#0b1830] border border-blue-900/60 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-left disabled:opacity-50"
          dir="ltr"
        />

        {gateError && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2 leading-relaxed">
            ⚠️ {gateError}
          </p>
        )}

        <button
          type="submit"
          disabled={verifying}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold rounded-xl text-sm shadow-lg transition disabled:opacity-50"
        >
          {verifying ? "جاري التحقق..." : "دخول الإدارة 🚀"}
        </button>

        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          بدون ضبط RAKSHTAK_ADMIN_TOKEN على الخادم تبقى البوابة مقفولة —
          هذا هو الوضع الآمن المتعمّد.
        </p>
      </form>
    </div>
  );
}
