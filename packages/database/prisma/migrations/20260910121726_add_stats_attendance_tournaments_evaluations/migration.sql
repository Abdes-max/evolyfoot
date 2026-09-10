-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "attendance" JSONB;

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN     "attendance" JSONB;

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date_label" TEXT NOT NULL,
    "result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_evaluations" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "scores" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournaments_educator_id_idx" ON "tournaments"("educator_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_evaluations_player_id_key" ON "player_evaluations"("player_id");

-- CreateIndex
CREATE INDEX "player_evaluations_educator_id_idx" ON "player_evaluations"("educator_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_evaluations" ADD CONSTRAINT "player_evaluations_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_evaluations" ADD CONSTRAINT "player_evaluations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
