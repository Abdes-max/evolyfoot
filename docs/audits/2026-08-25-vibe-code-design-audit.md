# Audit des 30 signes de design « vibe-codé »

Périmètre : tout le code servi au navigateur dans `apps/web/src/app` (composants React, feuilles de style et layout). État observé avant corrections automatiques, après le point de sauvegarde Git `63dc844`.

| # | Signe audité | Verdict avant correction | Preuve ou justification |
|---:|---|---|---|
| 1 | Dégradés criards multi-teintes | OK | Aucun `linear-gradient` ou `radial-gradient` dans le code web. |
| 2 | Icônes Lucide/Feather par défaut | NON APPLICABLE | Aucune dépendance ou import Lucide/Feather. Les glyphes Unicode existants relèvent du point 7. |
| 3 | Fond blanc pur `#ffffff` | TROUVÉ | `apps/web/src/app/globals.css:1,20-31` et `apps/web/src/app/observation.css:1` emploient `white`/`#fff` pour les surfaces. |
| 4 | Palette arc-en-ciel | TROUVÉ | `apps/web/src/app/globals.css:23` attribue vert, bleu et orange aux trois scores, en plus du citron de marque et du rouge sémantique. |
| 5 | Ombres portées sur tout | OK | Deux usages seulement : une carte de focus mise en avant et l'anneau d'un statut de timeline. Le signe « sur tout » est faux dans ce contexte ; ils sont conservés. |
| 6 | Trois cartes de features alignées | NON APPLICABLE | `priority-grid` affiche trois mesures opérationnelles du diagnostic, pas trois arguments marketing. Chaque carte contient une information distincte. |
| 7 | Emojis en guise d'icônes | TROUVÉ | Glyphes décoratifs dans `apps/web/src/app/page.tsx:15-18,34,45,56,62`. Les flèches directionnelles textuelles restent des indicateurs d'action. |
| 8 | Verre dépoli décoratif | OK | Aucun `backdrop-filter` ou `backdrop-blur`. |
| 9 | Tirets cadratins dans les textes | OK | Le demi-cadratin de `2026–27` exprime correctement une plage numérique et le cadratin du titre sépare deux métadonnées ; aucun tic de prose n'est présent. |
| 10 | Inter, Geist ou Space Grotesk comme police unique | OK | `apps/web/src/app/globals.css:4` commence par Manrope ; Inter n'est qu'un fallback. Le chargement et l'officialisation de la police restent une décision typographique. |
| 11 | Liseré coloré vertical | OK | Aucun accent `border-left`/`border-right` sur les encadrés ; la bordure de sidebar est structurelle. |
| 12 | Témoignages, étoiles ou logos non vérifiables | NON APPLICABLE | Aucun témoignage, notation ou logo de presse. |
| 13 | Grille bento décorative | OK | Les grilles correspondent aux tâches réelles : cycle, séance, priorités et observations. Aucune case purement décorative. |
| 14 | Fenêtre de terminal décorative | NON APPLICABLE | Aucune représentation de terminal. |
| 15 | Formule « ce n'est pas X, c'est Y » | OK | Aucun motif de copy de ce type. |
| 16 | Puces-coches partout | OK | Aucune série de coches décoratives. |
| 17 | Trois formules de prix avec milieu mis en avant | NON APPLICABLE | Aucun écran tarifaire. |
| 18 | Aucune démo du vrai produit | OK | Le produit réel est navigable localement sur `http://localhost:3001` avec onboarding, diagnostic, plan, séance et observation. |
| 19 | Même `border-radius` sur tout | OK | Le système différencie déjà pilules, contrôles, cartes secondaires et deux cartes principales à 23 px. Le signe « même rayon sur tout » est faux dans ce contexte ; les rayons sont conservés. |
| 20 | Violet saturé sur fond noir | NON APPLICABLE | Aucun violet ni fond noir. |
| 21 | Spinner seul | NON APPLICABLE | Aucun spinner ou écran de chargement isolé. |
| 22 | Orbes lumineux flous | OK | Aucun orb, glow flou ou décor équivalent. |
| 23 | Trame de points décorative | OK | Les deux points de timeline dans `globals.css:24` portent un statut réel ; aucune trame décorative. |
| 24 | Étincelles pour « IA » | TROUVÉ | `apps/web/src/app/page.tsx:62` utilise `✦` devant une suggestion et le libellé vague « SUGGESTION EVOLY ». |
| 25 | Flèches animées vers le CTA | OK | Les flèches sont statiques ; aucune animation. |
| 26 | Pas de CGU | TROUVÉ | Aucun écran ou document de CGU dans `apps/web`. Décision produit/juridique requise. |
| 27 | Pas de politique de confidentialité | TROUVÉ | Aucun écran ou document de confidentialité. Une future collecte d'email est prévue par la fondation de persistance ; décision juridique requise. |
| 28 | Animation au survol sur tout | OK | Le seul `:hover` explicite concerne les liens de navigation, qui sont cliquables (`globals.css:14`). |
| 29 | Néon saturé | TROUVÉ | L'accent citron `--lime:#d9f45d` dans `globals.css:1` est très saturé et utilisé sur badges et focus. |
| 30 | Pastels sans contraste | TROUVÉ | Mesures avant correction : `--muted`/papier 4,44:1 ; étapes onboarding/vert 3,29:1 ; orange score/pastel 3,85:1 ; bouton de détail/surface 3,29:1. Seuil visé : 4,5:1. |

## Corrections automatiques retenues

- Remplacer les surfaces blanches par le blanc cassé de surface.
- Réduire les couleurs de score à l'accent vert et des neutres, en préservant les couleurs sémantiques d'erreur.
- Retirer les glyphes décoratifs sans introduire de bibliothèque d'icônes.
- Remplacer l'étincelle et le libellé vague par « AJUSTEMENT DE SÉANCE ».
- Désaturer l'accent citron.
- Corriger et remesurer tous les contrastes inférieurs à 4,5:1.

## Décisions laissées intactes

- Choix futur d'un système d'icônes de marque : aucun Lucide/Feather n'est installé aujourd'hui.
- Police produit : la pile actuelle est `Manrope, Inter, Segoe UI, Arial, sans-serif` ; aucun changement sans décision.
- CGU et politique de confidentialité : aucun contenu juridique ne sera inventé pendant l'audit.

## Résultat après corrections

| Dimension technique | Score | Constat |
|---|---:|---|
| Accessibilité | 3/4 | Les contrastes textuels mesurés atteignent désormais au moins 4,5:1. Plusieurs actions historiques restent toutefois sous la cible tactile de 44 px et un passage complet au clavier/lecteur d'écran demeure nécessaire. |
| Performance | 4/4 | Aucune animation, image lourde, blur ou ombre coûteuse détectée. |
| Responsive | 3/4 | Les vues disposent de ruptures mobiles et de grilles repliables ; une validation visuelle multi-viewport reste nécessaire. |
| Thématisation | 3/4 | Les surfaces principales utilisent maintenant les tokens ; quelques couleurs sémantiques locales restent volontairement explicites. |
| Anti-patterns | 4/4 | Les signes automatiques réellement présents ont été supprimés sans transformer l'application en landing page générique. |
| **Total** | **17/20** | **Bon : corrections ciblées terminées, décisions de marque et juridiques encore ouvertes.** |

Contrastes remesurés : texte secondaire/papier 5,07:1 ; texte secondaire/surface 5,47:1 ; navigation/sidebar 5,39:1 ; libellé/carte saison 4,96:1 ; libellé/carte conseil 4,82:1 ; étapes onboarding/vert 4,52:1 ; score intermédiaire 6,30:1 ; score prioritaire 6,21:1 ; erreur/pastel 6,31:1.

Vérification fonctionnelle : 8 fichiers de tests et 15 tests réussis ; typecheck réussi ; lint réussi ; build Next.js 16.3.1 réussi. Le contrôle visuel automatisé de `localhost` a été bloqué par la politique d'accès du navigateur intégré ; il reste donc une vérification manuelle sur les largeurs bureau, tablette et mobile.
