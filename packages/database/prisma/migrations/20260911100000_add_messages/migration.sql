-- Fil de discussion coach <-> joueur/tuteur, un seul fil par joueur (voir le commentaire dans
-- schema.prisma).
CREATE TYPE "MessageAuthorRole" AS ENUM ('coach', 'player');

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "author_role" "MessageAuthorRole" NOT NULL,
    "author_name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_educator_id_player_id_created_at_idx" ON "messages"("educator_id", "player_id", "created_at");

ALTER TABLE "messages" ADD CONSTRAINT "messages_educator_id_fkey"
  FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
