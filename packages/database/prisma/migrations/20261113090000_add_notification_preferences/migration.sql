-- Réglages de notification du compte (JSON), vides = réglages par défaut.
ALTER TABLE "educators" ADD COLUMN "notification_preferences" JSONB;
