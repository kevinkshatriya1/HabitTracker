import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const bodyFont = Nunito({
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
    <html lang="en" className={bodyFont.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
