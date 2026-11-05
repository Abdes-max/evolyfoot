#!/usr/bin/env node
// Captures App Store d'EvolyFoot Coach : l'appli mobile tourne dans le navigateur (Expo web), sur
// un compte de démonstration créé dans l'API locale, puis chaque capture est habillée en visuel
// (fond de la marque, titre, cadre de téléphone ou de tablette) aux tailles exactes demandées par
// App Store Connect. Pas de barre d'état simulée (guideline 2.3.10), pas de données inventées
// présentées comme réelles : l'équipe de démo est fictive et ses écrans sont ceux de l'appli.
//
// Prérequis : l'API locale (`next dev -p 3100` avec sa base) et l'appli en web :
//   cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3100 npx expo start --web --port 8081
// Puis, depuis la racine : node scripts/store-screenshots/build.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoCoach } from "./demo-coach.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = process.env.MOBILE_URL ?? "http://localhost:8081";
const API = process.env.API_URL ?? "http://localhost:3100";
const STORE = join(REPO_ROOT, "apps", "mobile", "store-assets", "app-store");
const RAW = join(tmpdir(), "evolyfoot-store-raw");

// Viewport de capture puis canevas final (px CSS × échelle = pixels livrés).
const DEVICES = {
  iphone65: {
    phone: true,
    capture: { width: 390, height: 844, deviceScaleFactor: 3 },
    canvas: { width: 414, height: 896, deviceScaleFactor: 3 }, // 1242×2688 (6,5")
    outDir: join(STORE, "screenshots-6.5in"),
    frameWidth: 318,
    radius: 44,
  },
  iphone63: {
    phone: true,
    capture: { width: 390, height: 844, deviceScaleFactor: 3 },
    canvas: { width: 402, height: 874, deviceScaleFactor: 3 }, // 1206×2622 (6,3")
    outDir: join(STORE, "screenshots-6.3in"),
    frameWidth: 308,
    radius: 44,
  },
  ipad: {
    phone: false,
    capture: { width: 820, height: 1180, deviceScaleFactor: 2 },
    canvas: { width: 1032, height: 1376, deviceScaleFactor: 2 }, // 2064×2752 (13")
    outDir: join(STORE, "screenshots-ipad-13in"),
    frameWidth: 760,
    radius: 36,
  },
};

const SCREENS = [
  { name: "1-accueil", path: "/", title: "Ta semaine de coach, prête", subtitle: "Prochaine séance, match et ajustements" },
  { name: "2-saison", path: "/saison", title: "Une saison construite pour ton équipe", subtitle: "36 semaines guidées selon tes priorités" },
  {
    name: "3-seance",
    path: "/saison/seance/5?semaine=3&creneau=0",
    title: "Des séances clés en main",
    subtitle: "Schémas, consignes et variantes",
    scrollTo: "Jongler à deux",
  },
  { name: "4-bibliotheque", path: "/bibliotheque", title: "Une bibliothèque d’exercices", subtitle: "Filtrée par thème et par moment de séance" },
  { name: "5-diagnostic", path: "/diagnostic", title: "Pars de ce que voit le coach", subtitle: "Un diagnostic qui oriente tout le plan" },
];

/** L'API locale n'a pas de CORS : ses appels passent par Playwright, côté Node. */
async function routeApi(context) {
  const api = new URL(API);
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).host !== api.host) return route.continue();
    const cors = {
      "access-control-allow-origin": APP,
      "access-control-allow-headers": "authorization, content-type, x-client-platform",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
}

async function captureRaw(browser, name, device, token) {
  const context = await browser.newContext({
    viewport: { width: device.capture.width, height: device.capture.height },
    deviceScaleFactor: device.capture.deviceScaleFactor,
    isMobile: device.phone,
    hasTouch: true,
    colorScheme: "dark",
    locale: "fr-FR",
  });
  await context.addInitScript((value) => localStorage.setItem("evolyfoot.session-token", value), token);
  await routeApi(context);
  const page = await context.newPage();
  const files = {};
  for (const screen of SCREENS) {
    await page.goto(`${APP}${screen.path}`, { waitUntil: "networkidle" });
    if (screen.scrollTo) {
      // Le formulaire de préparation occupe le haut de l'écran : on montre la première situation.
      await page.getByText(screen.scrollTo, { exact: true }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    }
    await page.waitForTimeout(2000);
    const file = join(RAW, `${name}-${screen.name}.png`);
    await page.screenshot({ path: file });
    files[screen.name] = file;
    console.log(`capturé ${file}`);
  }
  await context.close();
  return files;
}

function composeHtml(screen, device, imageDataUrl) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${device.canvas.width}px; height: ${device.canvas.height}px; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #fff;
    overflow: hidden;
    background:
      radial-gradient(110% 55% at 90% 0%, rgba(47, 212, 255, 0.32), transparent 60%),
      radial-gradient(90% 50% at 0% 100%, rgba(47, 212, 255, 0.18), transparent 60%),
      linear-gradient(165deg, #070b12 0%, #0f2233 55%, #123349 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: ${device.phone ? 64 : 90}px;
  }
  .brand { font-size: ${device.phone ? 13 : 18}px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #2fd4ff; }
  h1 { margin-top: 12px; max-width: 90%; text-align: center; font-size: ${device.phone ? 32 : 52}px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; }
  p { margin-top: 12px; text-align: center; font-size: ${device.phone ? 17 : 26}px; font-weight: 500; color: rgba(255, 255, 255, 0.8); }
  .frame {
    margin-top: ${device.phone ? 36 : 56}px;
    width: ${device.frameWidth}px;
    padding: ${device.phone ? 10 : 14}px;
    border-radius: ${device.radius + 10}px;
    background: #05080d;
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(47, 212, 255, 0.18);
  }
  .frame img { display: block; width: 100%; border-radius: ${device.radius}px; }
</style></head><body>
  <div class="brand">EvolyFoot Coach</div>
  <h1>${screen.title}</h1>
  <p>${screen.subtitle}</p>
  <div class="frame"><img src="${imageDataUrl}" alt=""></div>
</body></html>`;
}

async function compose(browser, device, rawFiles) {
  mkdirSync(device.outDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: device.canvas.width, height: device.canvas.height },
    deviceScaleFactor: device.canvas.deviceScaleFactor,
  });
  const page = await context.newPage();
  for (const screen of SCREENS) {
    const data = readFileSync(rawFiles[screen.name]).toString("base64");
    const html = join(RAW, "compose.html");
    writeFileSync(html, composeHtml(screen, device, `data:image/png;base64,${data}`));
    await page.goto(`file://${html.replace(/\\/g, "/")}`, { waitUntil: "load" });
    const out = join(device.outDir, `${screen.name}.png`);
    await page.screenshot({ path: out });
    console.log(`composé ${out}`);
  }
  await context.close();
}

mkdirSync(RAW, { recursive: true });
const { token } = await createDemoCoach(API);
const browser = await chromium.launch();
try {
  const only = process.argv[2];
  for (const [name, device] of Object.entries(DEVICES)) {
    if (only && only !== name) continue;
    const raw = await captureRaw(browser, name, device, token);
    await compose(browser, device, raw);
  }
} finally {
  await browser.close();
}
