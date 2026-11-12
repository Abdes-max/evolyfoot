-- Rappels d'abonnement par e-mail : suppléments payés et dernier rappel envoyé.
ALTER TABLE "educators" ADD COLUMN "billed_extra_teams" INTEGER,
ADD COLUMN "billed_extra_coaches" INTEGER,
ADD COLUMN "billing_reminder" TEXT;
