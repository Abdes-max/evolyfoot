-- Une évaluation vient de l'éducateur ("coach") ou du joueur lui-même ("player").
ALTER TABLE "player_evaluations" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'coach';
