import { colors, radii } from "@evolyfoot/design-tokens";
import { fixtureFromTitle, parseCalendarFile, type GameFormat, type MatchVenue } from "@evolyfoot/domain";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth, type MobileMatch } from "../lib/auth-context";

interface Candidate {
  key: string;
  opponent: string;
  venue: MatchVenue;
  date: Date | null;
  location: string | null;
  duplicate: boolean;
  selected: boolean;
}

function frenchDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date).replace(/^\p{L}/u, (letter) => letter.toUpperCase());
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

interface CalendarImportProps {
  teamName: string;
  gameFormat: GameFormat;
  formationId: string;
  existing: readonly MobileMatch[];
  onImported: (matches: readonly MobileMatch[]) => void;
}

// Même import que la page Matchs du web : un fichier .ics (export du calendrier du club ou de la
// ligue), une liste à cocher, puis un match créé par ligne retenue.
export function CalendarImport({ teamName, gameFormat, formationId, existing, onImported }: CalendarImportProps) {
  const { createMatch } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  async function pickFile() {
    setMessage("");
    const result = await getDocumentAsync({ type: ["text/calendar", "text/plain", "application/octet-stream"], copyToCacheDirectory: true }).catch(() => null);
    const asset = result && !result.canceled ? result.assets[0] : null;
    if (!asset) {
      return;
    }
    let content: string;
    try {
      content = await new File(asset.uri).text();
    } catch {
      setMessage("Le fichier n’a pas pu être lu.");
      return;
    }
    const events = parseCalendarFile(content);
    if (events.length === 0) {
      setCandidates(null);
      setMessage("Aucun événement trouvé dans ce fichier.");
      return;
    }
    const now = Date.now();
    setCandidates(
      events.map((calendarEvent, index) => {
        const fixture = fixtureFromTitle(calendarEvent.title, teamName);
        const { date } = calendarEvent;
        const duplicate = existing.some(
          (match) => match.opponent.toLowerCase() === fixture.opponent.toLowerCase() && date !== null && match.date != null && sameDay(new Date(match.date), date),
        );
        const upcoming = date === null || date.getTime() >= now;
        return { key: `${index}-${calendarEvent.title}`, ...fixture, date, location: calendarEvent.location, duplicate, selected: upcoming && !duplicate };
      }),
    );
  }

  function toggle(key: string) {
    setCandidates((current) => current?.map((candidate) => (candidate.key === key ? { ...candidate, selected: !candidate.selected } : candidate)) ?? null);
  }

  async function importSelected() {
    const selected = candidates?.filter((candidate) => candidate.selected) ?? [];
    setImporting(true);
    setMessage("");
    const created: MobileMatch[] = [];
    let failed = 0;
    for (const candidate of selected) {
      const result = await createMatch({
        opponent: candidate.opponent,
        dateLabel: candidate.date ? frenchDateLabel(candidate.date) : "Date à préciser",
        date: candidate.date ? candidate.date.toISOString() : null,
        venue: candidate.venue,
        gameFormat,
        formationId,
        ...(candidate.location ? { location: candidate.location } : {}),
      });
      if (result.ok) {
        created.push(result.match);
      } else {
        failed += 1;
      }
    }
    setImporting(false);
    onImported(created);
    setCandidates(failed > 0 ? candidates : null);
    setMessage(`${created.length} match${created.length > 1 ? "s" : ""} importé${created.length > 1 ? "s" : ""}.${failed > 0 ? ` ${failed} n’ont pas pu être créés.` : ""}`);
  }

  const selectedCount = candidates?.filter((candidate) => candidate.selected).length ?? 0;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity accessibilityRole="button" onPress={pickFile} style={styles.pick}>
        <Text style={styles.pickText}>Importer un calendrier (.ics)</Text>
      </TouchableOpacity>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {candidates && (
        <View style={styles.review}>
          <Text style={styles.hint}>Coche les matchs à créer. Les dates passées et les matchs déjà présents sont décochés.</Text>
          {candidates.map((candidate) => (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: candidate.selected }}
              key={candidate.key}
              onPress={() => toggle(candidate.key)}
              style={styles.row}
            >
              <View style={[styles.box, candidate.selected && styles.boxChecked]}>{candidate.selected ? <Text style={styles.check}>✓</Text> : null}</View>
              <View style={styles.rowText}>
                <Text style={styles.opponent}>{candidate.opponent}</Text>
                <Text style={styles.hint}>
                  {[
                    candidate.date ? frenchDateLabel(candidate.date) : "Date à préciser",
                    candidate.venue === "home" ? "Domicile" : "Extérieur",
                    candidate.location,
                    candidate.duplicate ? "Déjà présent" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={importing || selectedCount === 0}
            onPress={importSelected}
            style={[styles.primary, (importing || selectedCount === 0) && styles.disabled]}
          >
            <Text style={styles.primaryText}>{importing ? "Import…" : `Créer ${selectedCount} match${selectedCount > 1 ? "s" : ""}`}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setCandidates(null)} style={styles.cancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  pick: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary, borderStyle: "dashed" },
  pickText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  message: { color: colors.ink, fontSize: 12, marginTop: 8 },
  review: { marginTop: 10, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 6 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  boxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  check: { color: colors.primaryInk, fontSize: 13, fontWeight: "900" },
  rowText: { flex: 1 },
  opponent: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  primary: { minHeight: 46, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  cancel: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
});
