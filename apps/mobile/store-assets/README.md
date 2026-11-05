# Visuels App Store — EvolyFoot Coach

À glisser dans App Store Connect (onglet de la version → Aperçus et captures d'écran).

| Dossier                            | Taille      | Emplacement App Store Connect                  |
| ---------------------------------- | ----------- | ---------------------------------------------- |
| `app-store/screenshots-6.3in/`     | 1206 × 2622 | iPhone 6,3" (obligatoire)                      |
| `app-store/screenshots-6.5in/`     | 1242 × 2688 | iPhone 6,5" (facultatif)                       |
| `app-store/screenshots-ipad-13in/` | 2064 × 2752 | iPad 13" (obligatoire, `supportsTablet: true`) |

Cinq écrans : accueil, saison guidée, séance type avec schémas, bibliothèque, diagnostic.

## Régénérer

Générés par `scripts/store-screenshots/build.mjs` : l'appli tourne dans le navigateur (Expo web),
connectée à l'API locale sur un compte de démonstration créé à chaque lancement (équipe fictive
« AS Les Lilas U11 »), puis chaque capture est habillée (fond de la marque, titre, cadre). Pas de
barre d'état simulée (guideline 2.3.10).

1. API locale : `next dev -p 3100` dans `apps/web`, avec sa base PostgreSQL.
2. Appli en web : `cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3100 npx expo start --web --port 8081`.
3. Depuis la racine : `node scripts/store-screenshots/build.mjs` (ou `iphone63`, `iphone65`, `ipad` pour une seule taille).
