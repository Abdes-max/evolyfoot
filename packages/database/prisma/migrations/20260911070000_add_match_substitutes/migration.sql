-- Banc de touche : liste des ids joueur sur le banc pour un match (sans poste, voir
-- MatchPlan.substitutePlayerIds côté domaine).
ALTER TABLE "matches" ADD COLUMN "substitute_player_ids" JSONB;
