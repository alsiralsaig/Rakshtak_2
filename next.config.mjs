/** @type {import('next').NextConfig} */
const nextConfig = {
  // البناء يشغّل فحص TypeScript نفسه — أي خطأ أنواع يكسر الـ Build
  // (تُشغَّل سابقاً يدوياً عبر: npm run typecheck)
  eslint: {
    // لا يوجد إعداد ESLint في المشروع — يتجاهله أثناء الـ Build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
