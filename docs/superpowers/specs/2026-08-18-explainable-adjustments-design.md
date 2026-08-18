# Ajustements explicables — Spécification

## Objectif

Transformer un rapport d’observation validé en une décision utile pour la prochaine séance, sans masquer le raisonnement à l’éducateur. Evoly propose ; l’éducateur accepte ou conserve son plan actuel.

## Parcours retenu

Après la synthèse d’une séance ou d’un match, Evoly affiche une seule proposition prioritaire. La carte explique :

- le signal terrain qui déclenche la proposition ;
- la règle utilisée ;
- le thème et la contrainte recommandés ;
- le comportement à observer la prochaine fois ;
- l’effet concret sur la prochaine séance.

L’éducateur choisit « Appliquer cet ajustement » ou « Garder mon plan ». Le choix produit une confirmation locale et reste réversible tant que la persistance n’existe pas.

## Décisions métier

Le moteur retourne exactement l’une des trois actions suivantes :

1. `reinforce` — un comportement est « À renforcer » (score 0). Evoly recommande le thème associé à ce comportement, une situation plus lisible et davantage de répétitions avant d’ajouter de la pression.
2. `progress` — la moyenne atteint au moins 75 et aucun comportement n’est à 0. Evoly maintient le thème prioritaire et augmente une seule contrainte, en réduisant le temps ou l’espace disponible.
3. `maintain` — tous les autres cas. Evoly conserve le thème et la contrainte actuels, avec le comportement le plus faible comme repère d’observation.

En cas d’égalité entre plusieurs faiblesses, l’ordre stable des quatre critères diagnostiques tranche. Une observation de match ou de séance utilise les mêmes règles.

## Modèle partagé

`packages/domain/src/adjustment.ts` expose :

- `AdjustmentAction` ;
- `AdjustmentSuggestion` ;
- `suggestAdjustmentFromObservation(report, currentWeek)`.

La suggestion contient un identifiant dérivé du rapport, l’action, un titre, une explication, le score déclencheur, le thème proposé, une contrainte, un observable et un résumé d’impact. Elle reste sérialisable et immuable.

Le moteur consomme `ObservationReport`, `DevelopmentWeek`, `diagnosticCriteria` et leurs thèmes existants. Il n’appelle aucune interface, API ou IA externe. L’ancien prototype `suggestAdjustment()` reste compatible pendant cette tranche, mais la nouvelle interface devient la référence du parcours navigable.

## Explications

Chaque raison doit citer une donnée observable, par exemple « Réagir après la perte est à 0/100 ». Les textes ne prétendent jamais à une causalité non mesurée et ne comparent pas les enfants entre eux.

Les contraintes sont déterministes :

- renforcer : espace légèrement agrandi, opposition progressive, répétitions courtes ;
- progresser : espace réduit ou décision à prendre plus vite ;
- maintenir : même organisation, observation recentrée sur le comportement le plus faible.

## Interface web

La synthèse `/observation` affiche la proposition sous le rapport validé. Une carte hiérarchise « Pourquoi », « Ce qui change » et « À observer ». Les deux actions utilisent de vrais boutons, conservent le focus et annoncent leur confirmation dans une région live.

Après acceptation, la carte montre « Ajustement appliqué à la prochaine séance » et permet « Annuler ». Après refus, elle montre « Plan actuel conservé » et permet de reconsidérer la proposition. Le prototype ne prétend pas avoir sauvegardé le choix sur un serveur.

## Interface mobile

La route Expo reprend la même proposition après la synthèse. Les actions respectent une cible minimale de 44 × 44 pixels, un état accessible et une annonce iOS/Android. Le contenu reste utilisable dans la liste verticale sans fenêtre modale.

## Erreurs et garde-fous

- Un rapport incomplet ne peut pas atteindre le moteur, car seul `ObservationReport` est accepté.
- Un score ou critère absent dans un objet désérialisé invalide provoque une erreur métier explicite.
- Une suggestion n’altère jamais le rapport ni la semaine source.
- Une seule contrainte change par suggestion.
- Aucun joueur individuel n’est nommé dans l’explication collective.
- Accepter ou refuser plusieurs fois reste idempotent dans l’état local.

## Tests

- Tests unitaires : les trois actions, seuil exact 75, égalité stable, événement match/séance, invalidité, immutabilité et sérialisation.
- Test d’intégration web : rapport « À renforcer », explication chiffrée, acceptation, annulation, refus et reconsidération.
- E2E : parcours plan → séance → observation → proposition → application.
- Mobile : typecheck et bundle Expo Android obligatoires ; les libellés et propriétés d’accessibilité sont relus pendant la revue.
- Toute la CI existante reste obligatoire au SHA final.

## Démonstration

La démonstration finale du prototype se termine par deux variantes :

1. quatre observations « En progrès » produisent un maintien du cap ;
2. « Réagir après la perte » à renforcer produit une recommandation chiffrée de renforcement.

Elle précise que le choix est local jusqu’à l’ajout de PostgreSQL et des comptes.

## Hors périmètre

- Génération par modèle de langage.
- Modification persistante du cycle ou de la séance.
- Historique et comparaison de plusieurs rapports.
- Notification automatique.
- Ajustement individuel du programme d’un enfant.
