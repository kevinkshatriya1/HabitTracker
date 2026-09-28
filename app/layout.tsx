import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keep Pace — Your accountability calendar",
  description: "Show up together. Track daily goals, share photo check-ins, and keep your crew accountable.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
