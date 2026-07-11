import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// The broadcast face: Archivo variable (weight + width axes), self-hosted
// through next/font. Condensed for hero numbers and the scoreboard bug,
// expanded for the masthead; the width axis does both from one file.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

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
    <html lang="en" className={`dark ${archivo.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
