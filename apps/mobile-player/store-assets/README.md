# Visuels et fiche App Store — EvolyFoot Player

| Dossier / fichier                  | Taille      | Emplacement App Store Connect                                      |
| ---------------------------------- | ----------- | ------------------------------------------------------------------ |
| `app-store/screenshots-6.3in/`     | 1206 × 2622 | iPhone 6,3" (obligatoire)                                          |
| `app-store/screenshots-6.5in/`     | 1242 × 2688 | iPhone 6,5" (facultatif)                                           |
| `app-store/screenshots-ipad-13in/` | 2064 × 2752 | iPad 13" (obligatoire, `supportsTablet: true`)                     |
| `metadata.fr.json`                 | —           | Textes de la fiche (nom, sous-titre, description, mots-clés, URLs) |

Cinq écrans : ma carte, calendrier, progression, messages, notifications.

## Régénérer les captures

Comme pour EvolyFoot Coach (voir `apps/mobile/store-assets/README.md`) : l'appli tourne dans le navigateur
(Expo web), connectée à l'API locale sur un compte joueur de démonstration (équipe fictive « AS Les Lilas
U11 », créé à chaque lancement), puis chaque capture est habillée (fond de la marque, titre, cadre). Pas de
barre d'état simulée (guideline 2.3.10).

1. API locale : `next dev -p 3100` dans `apps/web` avec sa base PostgreSQL.
2. Appli : `cd apps/mobile-player && EXPO_PUBLIC_API_URL=http://localhost:3100 npx expo start --web --port 8082`.
3. Depuis la racine : `node scripts/store-screenshots/build.mjs player` (ou `player iphone65` pour une seule taille).

## Envoyer à la revue App Store

Workflow « Submit iOS build to App Store review » (`.github/workflows/submit-ios-app-store.yml`), qui applique
la fiche et les captures, rattache le dernier build TestFlight traité puis soumet à Apple. Voir l'en-tête du
workflow pour ce qui reste à faire à la main dans App Store Connect (App Privacy, classification par âge,
compte de démonstration pour la revue, contrat, statut de commerçant).
