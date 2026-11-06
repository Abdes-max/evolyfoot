-- Lien d'invitation tuteur conservé en clair (réaffichable) et demandes de suivi à valider par
-- l'éducateur.
-- AlterTable
ALTER TABLE "player_invites" ADD COLUMN     "token" TEXT;

-- CreateTable
CREATE TABLE "player_follow_requests" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_follow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_follow_requests_player_id_idx" ON "player_follow_requests"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_follow_requests_account_id_player_id_key" ON "player_follow_requests"("account_id", "player_id");

-- AddForeignKey
ALTER TABLE "player_follow_requests" ADD CONSTRAINT "player_follow_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_follow_requests" ADD CONSTRAINT "player_follow_requests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

