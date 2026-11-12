-- Résiliation programmée d'un abonnement Stripe (fin de la période payée).
ALTER TABLE "educators" ADD COLUMN "subscription_cancel_at" TIMESTAMP(3);
