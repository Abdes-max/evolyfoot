-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_educator_id_idx" ON "password_resets"("educator_id");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
