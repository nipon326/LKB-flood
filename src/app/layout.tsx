import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "น้ำท่วมลาดกระบัง",
  description: "ติดตามระดับน้ำคลองประเวศฯ ฝน และประกาศเตือนภัยน้ำท่วม ลาดกระบัง",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "น้ำท่วมลาดกระบัง",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 3,
  themeColor: "#2a78d6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
