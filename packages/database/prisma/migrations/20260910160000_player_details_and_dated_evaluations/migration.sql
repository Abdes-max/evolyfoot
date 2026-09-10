-- Fiche joueur : infos optionnelles (photo en data URL redimensionnée côté client, date de
-- naissance en texte ISO, téléphone, e-mail).
ALTER TABLE "players" ADD COLUMN "photo" TEXT;
ALTER TABLE "players" ADD COLUMN "birth_date" TEXT;
ALTER TABLE "players" ADD COLUMN "phone" TEXT;
ALTER TABLE "players" ADD COLUMN "email" TEXT;

-- Les évaluations deviennent un historique daté : plusieurs par joueur au lieu d'une seule.
DROP INDEX "player_evaluations_player_id_key";
ALTER TABLE "player_evaluations" DROP COLUMN "updated_at";
CREATE INDEX "player_evaluations_player_id_idx" ON "player_evaluations"("player_id");
