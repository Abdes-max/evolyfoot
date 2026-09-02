-- AlterTable
ALTER TABLE "teams" ADD COLUMN "game_format" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "players_educator_id_idx" ON "players"("educator_id");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
