import type { MetadataRoute } from "next";
import { MARKETING_PATHS } from "@/marketing-routes";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evolyfoot.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.map((path) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
