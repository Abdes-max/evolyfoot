-- Créneaux récurrents de la saison : heure et lieu de chaque jour d'entraînement.
ALTER TABLE "season_programs" ADD COLUMN "schedule" JSONB;
