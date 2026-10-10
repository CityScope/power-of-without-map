import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Power of Without Map",
  description: "Atlas of Informal Settlements - interactive informality mapping platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions often inject attributes on <body> before hydration (e.g. bis_register). */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppNav />
        <div className="pt-[6.2rem] text-base antialiased">{children}</div>
      </body>
    </html>
  );
}
