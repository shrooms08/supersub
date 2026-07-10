import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Super Sub",
  description:
    "You are the fantasy substitute. One action: enter the pitch. The later and the worse it looks, the bigger the multiplier.",
};

export const viewport: Viewport = {
  themeColor: "#070708",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
