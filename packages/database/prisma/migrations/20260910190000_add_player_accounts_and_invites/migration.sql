-- Rôle de compte (coach par défaut) + joueur suivi pour les comptes tuteur/joueur.
ALTER TABLE "educators" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'coach';
ALTER TABLE "educators" ADD COLUMN "linked_player_id" UUID;

CREATE UNIQUE INDEX "educators_linked_player_id_key" ON "educators"("linked_player_id");
ALTER TABLE "educators" ADD CONSTRAINT "educators_linked_player_id_fkey"
  FOREIGN KEY ("linked_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invitations coach -> tuteur.
CREATE TABLE "player_invites" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "player_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_invites_token_hash_key" ON "player_invites"("token_hash");
CREATE INDEX "player_invites_educator_id_idx" ON "player_invites"("educator_id");
CREATE INDEX "player_invites_player_id_idx" ON "player_invites"("player_id");

ALTER TABLE "player_invites" ADD CONSTRAINT "player_invites_educator_id_fkey"
  FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_invites" ADD CONSTRAINT "player_invites_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
