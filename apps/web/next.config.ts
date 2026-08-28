import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@evolyfoot/domain"],
  // Sortie autonome : produit .next/standalone avec un serveur Node minimal et son propre
  // node_modules tracé, condition pour une image Docker de production légère.
  output: "standalone",
};

export default nextConfig;
