-- AlterTable
ALTER TABLE "educators" ADD COLUMN     "owner_educator_id" UUID;

-- CreateTable
CREATE TABLE "staff_invites" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_invites_token_hash_key" ON "staff_invites"("token_hash");

-- CreateIndex
CREATE INDEX "staff_invites_educator_id_idx" ON "staff_invites"("educator_id");

-- CreateIndex
CREATE INDEX "educators_owner_educator_id_idx" ON "educators"("owner_educator_id");

-- AddForeignKey
ALTER TABLE "educators" ADD CONSTRAINT "educators_owner_educator_id_fkey" FOREIGN KEY ("owner_educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
