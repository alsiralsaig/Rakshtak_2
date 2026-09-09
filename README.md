# Rakshtak_2
تطبيق للنقل والترحال والشحن 
# Rakshtak — ركشتك

تطبيق للنقل والترحال والشحن 🛺

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # ثم املأ القيم
npm run typecheck            # يجب أن يكون 0 أخطاء
npm run build
npm run dev
```

## المتغيرات المطلوبة

| المتغير | الوصف |
| --- | --- |
| `RAKSHTAK_ADMIN_TOKEN` | **بوابة الإدارة** — بدون قيمته تبقى `/admin` و`/dashboard` وكل مسارات `/api` الإدارية مقفولة (403). ولّده بـ `openssl rand -hex 24` |
| `DATABASE_URL` | قاعدة بيانات Neon (طبقة المسارات القديمة — تُستبدل بـ Supabase في المرحلة 2) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (التطبيق الحي) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (التطبيق الحي) |
| `PUSHER_*` | إشعارات المسارات القديمة |

## الأمان (ملخص)

- مسارات `/api` كلها خلف `RAKSHTAK_ADMIN_TOKEN` عبر `x-admin-token`؛ بدونها 403.
- `/api/auth/login` لا يقبل رمزاً ثابتاً (أُلغي `1234`) وهو موقوف 503 حتى OTP حقيقي.
- الاستجابات لا تعيد `customerPhone`/`bankAccount`.
- `PATCH /api/rides/[id]`: تحديث جزئي + حالات مسموحة + تقييم بلا تكرار.
- `/admin` و`/dashboard` خلف بوابة؛ و`firebase-messaging-sw.js` حُذف.
- لوحة السائق: قبول شرطي + «مشواري أنا» + اشتراك واحد + WebAudio داخلي + قناع الحساب.
- صفحة الراكب: هاتف أدق + مهلة بحث + زوّد السعر ٢٠٪ + تنسيق السعر.
- `service-worker.js` لا يخزّن HTML.

التفاصيل الكاملة: [`HOTFIX-NOTES.md`](./HOTFIX-NOTES.md).
