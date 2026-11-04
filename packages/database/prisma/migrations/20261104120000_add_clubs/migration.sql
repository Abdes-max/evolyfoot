-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "educators" ADD COLUMN "club_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "clubs_join_code_key" ON "clubs"("join_code");

-- CreateIndex
CREATE INDEX "educators_club_id_idx" ON "educators"("club_id");

-- AddForeignKey
ALTER TABLE "educators" ADD CONSTRAINT "educators_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
