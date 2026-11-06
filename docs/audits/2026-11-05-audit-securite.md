# Audit sécurité — 5 novembre 2026

Périmètre : site et API (`apps/web`), base (`packages/database`), apps mobiles Coach et Player,
dépendances, image Docker de production. Fait après l'ajout du détourage des photos (#178) et des
convocations aux entraînements programmées (#180).

## Contrôlé, conforme

| Point                                      | Constat                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentification des routes API            | Toutes les routes vérifient la session, sauf les routes publiques attendues : connexion, inscription, mot de passe oublié/réinitialisé, vérification d'e-mail, contact, invitations par jeton, santé.               |
| Cloisonnement des rôles                    | `getEducatorForSession` refuse les comptes joueur/tuteur et « team » ; un adjoint travaille sur l'espace de son éducateur ; les routes joueur passent par `resolvePlayerAccountFromRequest`.                        |
| Accès aux données d'un autre compte (IDOR) | Les dépôts filtrent par `educatorId` (`findFirst`/`updateMany` sur `{ id, educatorId }`). Côté joueur : chaque action vérifie le lien de suivi de l'enfant (`player_followers`), y compris la nouvelle route photo. |
| Convocations                               | La réponse d'un joueur est refusée tant que la séance n'est pas convoquée ; le planificateur n'envoie qu'une fois (`convoked_at`).                                                                                  |
| Cookie de session                          | `HttpOnly`, `SameSite=Lax`, `Secure` en production ; le jeton n'est jamais exposé au JavaScript du site. Mobile : jeton dans le trousseau (`expo-secure-store`).                                                    |
| Mots de passe                              | scrypt + sel, comparaison en temps constant.                                                                                                                                                                        |
| En-têtes                                   | CSP (`frame-ancestors 'none'`, `connect-src 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS en production.                                                                                    |
| Limites de débit                           | Connexion, inscriptions, mot de passe, contact, suppression de compte, recherche de lieux.                                                                                                                          |
| Taille des requêtes                        | `proxy.ts` refuse un corps API de plus de 3 Mo (413).                                                                                                                                                               |
| E-mails                                    | Contenu échappé (`escapeHtml`) : un titre ou un lieu saisi par l'éducateur ne peut pas injecter de HTML chez les parents.                                                                                           |
| Photos                                     | Data URL `image/*` plafonnée (700 Ko) ; affichées en `<img>` (aucun script exécuté, même en SVG). Détourage sur notre serveur, rien n'est envoyé à un tiers, rien n'est stocké.                                     |
| Administration                             | Métriques réservées aux e-mails listés dans `ADMIN_EMAILS`.                                                                                                                                                         |
| Secrets                                    | Aucun secret dans le dépôt (seuls les `.env*.example`, sans valeur réelle).                                                                                                                                         |

## Corrigé dans cette PR

1. **Détourage des photos : déni de service par un compte connecté** (moyen). La route occupait le
   processeur 2 à 3 s par appel, sans limite. Ajouts : 30 détourages par heure et par compte (429),
   2 détourages simultanés au plus sur le serveur (503), et image réduite à 1024 px (plafond de
   40 Mpx à la lecture) avant le modèle, contre les images minuscules en octets mais immenses en
   pixels.
2. **Dépendances du serveur** (hautes et moyennes). Overrides vers les versions corrigées, sans
   changement de version majeure : `fast-uri`, `hono`, `@hono/node-server` 1.x, `lodash`,
   `mysql2`, `valibot`, `zod` < 3.22.3. Les alertes serveur passent de 26 à 2.

## Restant, accepté

- `deepmerge-ts` 7 et `@hono/node-server` 1 : outillage de développement de Prisma (Prisma Studio),
  non chargé par le serveur en production ; le correctif demande une version majeure.
- Apps mobiles : 46 alertes dans l'outillage de build Expo (`node-forge`, `@xmldom/xmldom`,
  `js-yaml`, `glob`…), qui ne sont pas embarquées dans les apps installées. À reprendre avec la
  prochaine montée de version d'Expo.
- Plafond de taille fondé sur `Content-Length` : une requête en transfert fragmenté n'est pas
  bornée par `proxy.ts`. À doubler d'une limite `request_body` dans Caddy (configuration du
  serveur, hors dépôt).
- Limites de débit en mémoire : remises à zéro au redémarrage, suffisant avec un seul conteneur.
