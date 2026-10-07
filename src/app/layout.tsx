import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kegelclub", template: "%s · Kegelclub" },
  description: "Vereins-App für Kegelabende, Spiele, Ergebnisse und Strafen.",
  appleWebApp: { capable: true, title: "Kegelclub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1d1510",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
