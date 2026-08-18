# Constructeur de séance — Spécification

## Objectif

Permettre à un éducateur U10 à U13 d’obtenir en quelques secondes une séance cohérente avec la semaine de son cycle, puis de l’adapter en moins de dix minutes.

## Parcours retenu

EvolyFoot génère une séance unique à partir du thème, de l’intention et de la phase de la semaine du cycle. L’éducateur conserve la décision finale et peut modifier les durées, réordonner les blocs ou remplacer une situation par une alternative compatible.

La séance cible dure 75 minutes. L’interface accepte une durée totale de 60 à 90 minutes et affiche une alerte explicite en dehors de cette plage.

## Structure d’une séance

Une séance contient quatre blocs ordonnés :

1. Accueil et activation.
2. Mise en action liée au thème.
3. Situation principale centrée sur l’intention de la semaine.
4. Jeu final permettant d’observer le transfert.

Chaque bloc expose : un titre, un type, une durée, un objectif, une organisation, une consigne principale et un repère d’observation. La durée minimale d’un bloc est de 5 minutes.

## Architecture

Le package `domain` porte le catalogue initial de situations et les fonctions pures de génération et de modification. Il ne dépend d’aucune interface. Les applications web et mobile consomment le même modèle de séance.

La génération sélectionne une situation compatible avec le thème et le type de bloc. Elle reste déterministe pour qu’une même semaine produise une proposition stable. Le remplacement choisit une autre situation compatible et conserve la durée du bloc remplacé lorsque cela reste valide.

Le prototype utilise des données locales. La persistance du choix de l’éducateur sera ajoutée pendant la phase PostgreSQL/API.

## Interface web

La page séance présente le contexte du cycle, la durée totale et les quatre blocs. Chaque bloc propose les actions suivantes : diminuer ou augmenter la durée par pas de 5 minutes, monter ou descendre dans l’ordre, et remplacer la situation.

Une synthèse reste visible : durée totale, nombre de joueurs, thème et intention. L’action finale « Valider cette séance » confirme la proposition localement et prépare le futur parcours d’observation.

## Interface mobile

La version mobile présente les mêmes données dans une liste verticale. Les modifications essentielles sont disponibles sans glisser-déposer : boutons de durée, déplacement et remplacement. Cette approche garantit l’accessibilité tactile et un comportement identique sur Android et iOS.

## Règles et erreurs

- La séance comporte toujours exactement quatre blocs dans le MVP.
- Un bloc dure au minimum 5 minutes.
- Les déplacements aux limites de la liste sont ignorés proprement.
- Un remplacement impossible conserve la situation actuelle.
- Une durée totale inférieure à 60 minutes ou supérieure à 90 minutes déclenche une alerte sans bloquer l’édition.
- La validation finale est bloquée tant que la durée totale est hors plage.

## Tests

- Tests unitaires du domaine : génération déterministe, total de 75 minutes, ajustement de durée, réordonnancement, remplacement compatible et limites.
- Test d’intégration web : modification d’un bloc et recalcul immédiat du total.
- Test E2E : ouverture depuis le plan, personnalisation et validation d’une séance dans la plage autorisée.
- Typecheck, lint et build web/mobile restent obligatoires dans la CI.

## Hors périmètre

- Création libre d’une situation.
- Glisser-déposer.
- Plusieurs propositions complètes concurrentes.
- Partage ou impression de la séance.
- Persistance serveur et synchronisation multi-appareils.
