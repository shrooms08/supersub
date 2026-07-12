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
  metadataBase: new URL("https://supersub-tau.vercel.app"),
  title: "Super Sub",
  description:
    "Choose the minute you enter a real live match, and get scored on what actually happens next.",
  // Icons declared explicitly (belt and braces): this guarantees the
  // <link rel="icon"> tags are in the served HTML even if the app-router
  // file convention does not emit on a given build. The SVG mark is the
  // primary favicon; public/favicon.ico is the universal fallback;
  // apple-icon.png is the touch icon.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Super Sub",
    description:
      "Choose the minute you enter a real live match, and get scored on what actually happens next.",
    siteName: "Super Sub",
    images: [{ url: "/mark-512.png", width: 512, height: 512, alt: "Super Sub" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Super Sub",
    description:
      "Choose the minute you enter a real live match, and get scored on what actually happens next.",
    images: ["/mark-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
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
