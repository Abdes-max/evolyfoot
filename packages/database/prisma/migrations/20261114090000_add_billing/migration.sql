-- Abonnement Stripe sur le compte coach.
ALTER TABLE "educators" ADD COLUMN "trial_ends_at" TIMESTAMP(3),
ADD COLUMN "stripe_customer_id" TEXT,
ADD COLUMN "stripe_subscription_id" TEXT,
ADD COLUMN "subscription_status" TEXT,
ADD COLUMN "billing_cycle" TEXT,
ADD COLUMN "current_period_end" TIMESTAMP(3);

CREATE UNIQUE INDEX "educators_stripe_customer_id_key" ON "educators"("stripe_customer_id");

-- Les coachs inscrits avant le paiement ont 14 jours d'essai à partir de sa mise en service.
UPDATE "educators" SET "trial_ends_at" = NOW() + INTERVAL '14 days' WHERE "role" = 'coach';
