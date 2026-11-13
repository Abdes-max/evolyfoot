#!/usr/bin/env node
// Visuels Google Play d'EvolyFoot Coach et d'EvolyFoot Player, tirés des visuels App Store déjà
// générés par build.mjs (aucune nouvelle capture) :
//   - icône 512 × 512 ;
//   - captures téléphone au format 1:2 (Google refuse un côté plus de deux fois plus long que
//     l'autre : les captures iPhone 1242 × 2688 sont élargies à 1344 × 2688 en prolongeant leurs bords) ;
//   - captures tablette 10" (les captures iPad 13", déjà au bon format) ;
//   - image de présentation 1024 × 500.
// node scripts/store-screenshots/play-assets.mjs
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// sharp vient avec Next (apps/web) : pas de nouvelle dépendance.
const sharp = createRequire(join(REPO_ROOT, "apps", "web", "package.json"))("sharp");

const APPS = [
  { dir: "mobile", name: "EvolyFoot Coach", tagline: "Entraîne, convoque, progresse" },
  { dir: "mobile-player", name: "EvolyFoot Player", tagline: "Ta carte et tes convocations" },
];

// Même fond que les visuels App Store (build.mjs).
const background = (width, height) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#070b12"/><stop offset="0.55" stop-color="#0f2233"/><stop offset="1" stop-color="#123349"/>
    </linearGradient>
    <radialGradient id="r" cx="0.9" cy="0" r="0.7"><stop offset="0" stop-color="#2fd4ff" stop-opacity="0.32"/><stop offset="1" stop-color="#2fd4ff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>
</svg>`);

for (const app of APPS) {
  const root = join(REPO_ROOT, "apps", app.dir);
  const out = join(root, "store-assets", "google-play");
  mkdirSync(join(out, "phone"), { recursive: true });
  mkdirSync(join(out, "tablet"), { recursive: true });

  await sharp(join(root, "assets", "icon.png"))
    .resize(512, 512)
    .png()
    .toFile(join(out, "icon-512.png"));

  const phoneDir = join(root, "store-assets", "app-store", "screenshots-6.5in");
  for (const file of readdirSync(phoneDir).filter((name) => name.endsWith(".png"))) {
    const shot = await sharp(join(phoneDir, file)).metadata();
    const height = shot.height;
    const width = Math.ceil(height / 2);
    // Bords prolongés à l'identique : le fond de la capture continue sans raccord visible.
    const left = Math.floor((width - shot.width) / 2);
    await sharp(join(phoneDir, file))
      .extend({ left, right: width - shot.width - left, extendWith: "copy" })
      .png()
      .toFile(join(out, "phone", file));
  }

  const tabletDir = join(root, "store-assets", "app-store", "screenshots-ipad-13in");
  for (const file of readdirSync(tabletDir).filter((name) => name.endsWith(".png"))) {
    copyFileSync(join(tabletDir, file), join(out, "tablet", file));
  }

  const icon = await sharp(join(root, "assets", "icon.png"))
    .resize(260, 260)
    .png()
    .toBuffer();
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <text x="380" y="235" font-family="Segoe UI, Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff">${app.name}</text>
  <text x="382" y="295" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#9fdcf0">${app.tagline}</text>
</svg>`);
  await sharp(background(1024, 500))
    .composite([
      { input: icon, left: 80, top: 120 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(join(out, "feature-graphic-1024x500.png"));

  console.log(`✓ ${app.name} → ${out}`);
}
