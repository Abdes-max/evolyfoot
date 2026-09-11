-- Confirmation de l'adresse e-mail à l'inscription (envoi via Brevo en prod, Mailhog en local).
ALTER TABLE "educators" ADD COLUMN "email_verified_at" TIMESTAMP(3);

CREATE TABLE "email_verifications" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verifications_token_hash_key" ON "email_verifications"("token_hash");
CREATE INDEX "email_verifications_educator_id_idx" ON "email_verifications"("educator_id");

ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_educator_id_fkey"
  FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
