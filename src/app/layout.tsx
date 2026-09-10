import type { Metadata, Viewport } from "next";
import "./globals.css";

// 1️⃣ تصدير الـ Viewport بشكل مستقل (لحله تحذير themeColor)
export const viewport: Viewport = {
  themeColor: "#0c4a6e",
  width: "device-width",
  initialScale: 1,
};

// 2️⃣ تصدير الـ Metadata بدون themeColor
export const metadata: Metadata = {
  title: "ركشتك - Rakshatak",
  description: "تطبيق طلب الركشات والتكسي",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ركشتك",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js');
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
