import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Profilbilder werden clientseitig verkleinert; 3 MB lässt Puffer für das Original-Limit (2 MB).
    serverActions: { bodySizeLimit: "3mb" },
    // Bereits besuchte Seiten 30 s im Browser vorhalten: Zurück-Navigation und erneutes Öffnen sind sofort da.
    // Eigene Änderungen (Server Actions mit revalidatePath) leeren den Cache trotzdem sofort.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Service Worker nie zwischenspeichern, damit Updates sofort ankommen.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
