import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Keep Pace — Your accountability calendar",
  description: "Show up together. Track daily goals, share photo check-ins, and keep your crew accountable.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,title:"Keep Pace",statusBarStyle:"default"},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={displayFont.variable + " " + bodyFont.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
