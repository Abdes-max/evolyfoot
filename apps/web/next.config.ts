import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Les scripts et styles en ligne restent permis : Next.js en génère à chaque page statique. Le
// serveur de développement a besoin en plus d'eval et de son canal de rechargement.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isProduction ? "" : " ws:"}`,
  "frame-src https://maps.google.com https://www.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@evolyfoot/domain"],
  // Détourage des photos (onnxruntime et sharp, binaires natifs + modèles) : chargé tel quel par
  // Node plutôt que regroupé, et ses fichiers copiés dans la sortie autonome.
  serverExternalPackages: ["@imgly/background-removal-node", "onnxruntime-node", "sharp"],
  outputFileTracingIncludes: {
    "/api/photos/detourage": [
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/**/*",
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/**/*",
      "../../node_modules/.pnpm/sharp@*/node_modules/**/*",
    ],
  },
  // Sortie autonome : produit .next/standalone avec un serveur Node minimal et son propre
  // node_modules tracé, condition pour une image Docker de production légère.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
