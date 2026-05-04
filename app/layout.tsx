import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ValueScope — 가치체계 인식 시각화",
  description: "경영진 인터뷰와 구성원 서베이의 의미 관계를 마인드맵으로",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}
