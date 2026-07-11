import type { Metadata, Viewport } from "next";
import { Archivo, Pirata_One, Saira_Condensed, Zilla_Slab } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// The canonical type system (docs/design/SuperSub.dc.html), all four faces
// self-hosted at build time via next/font; no runtime font requests.
//   Saira Condensed  hero numerals, scores, clocks, ratings, signing inputs
//   Zilla Slab       gazette body copy and the Gaffer quote
//   Pirata One       broadsheet mastheads only
//   Archivo          labels, microcopy, buttons, tracked uppercase captions
const saira = Saira_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-saira",
  display: "swap",
});
const zilla = Zilla_Slab({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zilla",
  display: "swap",
});
const pirata = Pirata_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pirata",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html
      lang="en"
      className={`dark ${saira.variable} ${zilla.variable} ${pirata.variable} ${archivo.variable}`}
    >
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
