-- AlterTable
ALTER TABLE "educators" ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "educators" ALTER COLUMN "password_hash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_educator_id_idx" ON "sessions"("educator_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
