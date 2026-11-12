-- Compo type de l'équipe (indépendante des matchs).
ALTER TABLE "teams" ADD COLUMN "default_lineup" JSONB;
