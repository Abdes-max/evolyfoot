-- Un compte tuteur/joueur peut suivre plusieurs enfants, et un enfant plusieurs comptes (les deux
-- parents). `educators.linked_player_id` reste l'enfant affiché, mais n'est plus unique.
CREATE TABLE "player_followers" (
    "account_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_followers_pkey" PRIMARY KEY ("account_id","player_id")
);

CREATE INDEX "player_followers_player_id_idx" ON "player_followers"("player_id");

ALTER TABLE "player_followers" ADD CONSTRAINT "player_followers_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_followers" ADD CONSTRAINT "player_followers_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les comptes existants suivent leur enfant actuel.
INSERT INTO "player_followers" ("account_id", "player_id")
SELECT "id", "linked_player_id" FROM "educators" WHERE "linked_player_id" IS NOT NULL;

DROP INDEX "educators_linked_player_id_key";
