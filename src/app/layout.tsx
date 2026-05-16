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
<<<<<<< HEAD
  title: "AppForge",
  description: "Autonomous software factory",
=======
  title: "AppForge — AI Software Factory",
  description: "Give AppForge an idea. It researches, builds, deploys, and maintains your app autonomously.",
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
<<<<<<< HEAD
      <body className="min-h-full bg-[#000] text-white flex flex-col">{children}</body>
=======
      <body className="h-full">{children}</body>
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
    </html>
  );
}
