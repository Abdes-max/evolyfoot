import type { MetadataRoute } from "next";
import { MARKETING_PATHS } from "@/marketing-routes";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evolyfoot.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // Seules les pages vitrine sont indexables ; tout le reste (l'app, /connexion, /inscription,
    // /api) est privé ou sans intérêt pour un moteur.
    rules: {
      userAgent: "*",
      allow: [...MARKETING_PATHS],
      disallow: ["/app", "/connexion", "/inscription", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
