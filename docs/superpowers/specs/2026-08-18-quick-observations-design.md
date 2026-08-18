# Observations rapides — Spécification

## Objectif

Permettre à un éducateur U10 à U13 de consigner en moins de trois minutes ce qu’il a vu après une séance ou un match. Le compte rendu doit être assez simple pour être rempli au bord du terrain et assez structuré pour alimenter ensuite une proposition d’ajustement explicable.

## Parcours retenu

Le même parcours couvre une séance et un match. L’éducateur choisit le contexte, évalue quatre comportements collectifs, signale facultativement quelques joueurs, puis valide une synthèse.

Chaque comportement utilise trois niveaux formulés sans jugement :

1. À renforcer.
2. En progrès.
3. Acquis aujourd’hui.

Une note libre courte reste facultative. Aucun passage joueur par joueur n’est imposé.

## Modèle métier

Le package `domain` expose un rapport d’observation indépendant des interfaces :

- un identifiant stable ;
- le type d’événement `training` ou `match` ;
- un libellé et une date affichable ;
- quatre évaluations collectives liées aux critères existants du diagnostic ;
- zéro à quelques signaux individuels ;
- une note facultative ;
- une synthèse calculée.

Les niveaux sont normalisés en scores 0, 50 et 100 uniquement dans le domaine. La synthèse calcule la tendance globale, le comportement le plus solide et celui à renforcer. Elle ne modifie pas encore le cycle : elle fournit l’entrée structurée du futur moteur d’ajustement.

Un signal individuel associe un joueur à l’un des statuts `highlight` ou `support`. Le prototype utilise une petite liste locale de joueurs de démonstration ; la liste réelle viendra avec la persistance des équipes.

## Règles

- Les quatre comportements collectifs doivent être évalués avant validation.
- Les signaux individuels sont facultatifs et un joueur ne peut avoir qu’un seul statut à la fois.
- Une note vide ou composée uniquement d’espaces est supprimée de la synthèse.
- Le rapport validé est immuable du point de vue des interfaces.
- La séance et le match produisent exactement le même format de sortie.
- Les fonctions métier ignorent proprement un critère ou un joueur inconnu.

## Interface web

La route `/observation` présente :

1. deux choix accessibles « Après une séance » et « Après un match » ;
2. quatre cartes de comportements avec trois boutons chacune ;
3. une zone facultative « Joueurs à retenir » permettant de marquer une réussite ou un besoin d’accompagnement ;
4. une note courte facultative ;
5. un bouton de validation désactivé tant que les quatre comportements ne sont pas renseignés.

Après validation, la page affiche une synthèse lisible : tendance, point fort, priorité à renforcer et nombre de joueurs signalés. Le parcours séance expose un lien vers cette route après validation, et le tableau de bord propose également l’entrée match.

## Interface mobile

La route Expo `/observation` reprend le même ordre dans une liste verticale. Les choix utilisent des contrôles tactiles d’au moins 44 × 44 pixels, des états sélectionnés explicites et des libellés accessibles. La synthèse finale est annoncée aux technologies d’assistance.

## Architecture et flux

`packages/domain/src/observation.ts` porte les types, les critères, les transitions pures et la synthèse. Les composants web et mobile conservent uniquement l’état temporaire du formulaire et appellent cette API partagée.

Les données restent locales pendant la phase de prototype. Aucune API, authentification ou base de données n’est ajoutée dans cette tranche. Le format du rapport est cependant conçu pour être sérialisable sans transformation lors de la future persistance.

## Erreurs et accessibilité

- Le bouton final explique quels comportements restent à renseigner.
- Les changements de niveau et de statut sont représentés par `aria-pressed` sur le web et `accessibilityState` sur mobile.
- La synthèse utilise une région live non intrusive.
- Les couleurs ne sont jamais le seul indicateur d’état.
- Une interaction répétée sur le statut individuel actif le retire.

## Tests

- Tests unitaires : normalisation des niveaux, complétude, bascule individuelle, nettoyage de note et synthèse.
- Test d’intégration web : choix du contexte, quatre évaluations, signal individuel, validation et synthèse.
- E2E : parcours plan → séance validée → observation de séance, puis validation d’un rapport.
- Validation mobile : typecheck et bundle Expo Android dans la CI.
- Les contrôles existants de lint, build et installation verrouillée restent obligatoires.

## Démonstration

À l’issue de la tranche, une démonstration guidée présentera le parcours complet du prototype : création d’équipe, diagnostic, cycle de quatre semaines, construction de séance et observation rapide. Elle précisera également ce qui reste simulé localement avant la phase PostgreSQL.

## Hors périmètre

- Historique persistant des observations.
- Pièces jointes, photos ou vidéo.
- Statistiques détaillées par joueur.
- Commentaires obligatoires pour chaque enfant.
- Ajustement automatique du cycle, traité dans la tranche suivante.
