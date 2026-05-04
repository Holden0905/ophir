import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  Libre_Baskerville,
  Outfit,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// Newspaper-set serif for body prose — closest free analog to FT's Financier Text.
const newspaper = Libre_Baskerville({
  variable: "--font-newspaper",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ophir",
    template: "%s — Ophir",
  },
  description: "A personal market intelligence system.",
  applicationName: "Ophir",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ophir",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${plexMono.variable} ${outfit.variable} ${playfair.variable} ${newspaper.variable}`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
