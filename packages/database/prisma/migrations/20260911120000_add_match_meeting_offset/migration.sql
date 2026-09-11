-- Rendez-vous calculé automatiquement (X minutes avant le coup d'envoi) plutôt que ressaisi en
-- texte libre -- voir le commentaire sur MatchRecord.meetingOffsetMinutes dans schema.prisma.
ALTER TABLE "matches" ADD COLUMN "meeting_offset_minutes" INTEGER;
