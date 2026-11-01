import { colors } from "@evolyfoot/design-tokens";
import {
  playerAspectCodes,
  playerEvaluationAspects,
  playerOverallScore,
  playerPositionCodes,
  type PlayerEvaluationScores,
  type PlayerPosition,
  type PlayerSeasonTotals,
} from "@evolyfoot/domain";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 470;
// Écusson dessiné dans le repère de la carte. Le halo vient de contours superposés : les ombres
// colorées ne s'appliquent pas à une forme SVG sur Android.
const CREST =
  "M12 34 L34 12 H108 L122 24 H178 L192 12 H266 L288 34 V400 L150 458 L12 400 Z";

interface PlayerCardProps {
  name: string;
  photo: string | null;
  position: string | null;
  jerseyNumber: string | null;
  preferredFoot: string | null;
  scores: PlayerEvaluationScores | null;
  season: PlayerSeasonTotals;
}

function frenchNumber(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function PlayerCard({ name, photo, position, jerseyNumber, preferredFoot, scores, season }: PlayerCardProps) {
  const positionCode = position ? (playerPositionCodes[position as PlayerPosition] ?? position) : null;
  const topScore = scores ? Math.max(...playerEvaluationAspects.map((aspect) => scores[aspect])) : null;
  const columns = [playerEvaluationAspects.slice(0, 4), playerEvaluationAspects.slice(4)];

  return (
    <View accessibilityLabel={`Carte de ${name}`} style={styles.card}>
      <Svg height={CARD_HEIGHT} style={StyleSheet.absoluteFill} viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`} width={CARD_WIDTH}>
        <Defs>
          <LinearGradient id="edge" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="0.6" stopColor={colors.lime} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
          <RadialGradient cx="50%" cy="22%" id="top" r="62%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.55" />
            <Stop offset="1" stopColor="#07121f" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Path d={CREST} fill="none" stroke={colors.primary} strokeOpacity={0.12} strokeWidth={22} />
        <Path d={CREST} fill="none" stroke={colors.primary} strokeOpacity={0.22} strokeWidth={12} />
        <Path d={CREST} fill="url(#top)" stroke="url(#edge)" strokeWidth={2.5} />
      </Svg>

      <View style={styles.top}>
        <View style={styles.rating}>
          <Text style={styles.overall}>{scores ? frenchNumber(playerOverallScore(scores)) : "—"}</Text>
          {positionCode ? <Text style={styles.position}>{positionCode}</Text> : null}
          {jerseyNumber ? <Text style={styles.jersey}>N° {jerseyNumber}</Text> : null}
        </View>
        {photo ? (
          <Image accessibilityLabel={`Photo de ${name}`} source={{ uri: photo }} style={styles.photo} />
        ) : (
          <Text style={styles.initial}>{name.trim().slice(0, 1).toUpperCase() || "?"}</Text>
        )}
      </View>

      <Text numberOfLines={2} style={styles.name}>
        {name}
      </Text>
      {preferredFoot ? <Text style={styles.foot}>Pied fort : {preferredFoot.toLowerCase()}</Text> : null}

      {scores ? (
        <View style={styles.stats}>
          {columns.map((aspects, index) => (
            <View key={index} style={[styles.column, index === 0 && styles.columnDivider]}>
              {aspects.map((aspect) => (
                <View key={aspect} style={styles.stat}>
                  <Text style={styles.statValue}>{scores[aspect]}</Text>
                  <Text style={[styles.statCode, scores[aspect] === topScore && styles.statTop]}>{playerAspectCodes[aspect]}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Ta carte se remplit avec ta première évaluation.</Text>
      )}

      <View style={styles.season}>
        {[
          [season.matches, "Matchs"],
          [season.goals, "Buts"],
          [season.assists, "Passes"],
        ].map(([value, label]) => (
          <View key={label} style={styles.seasonItem}>
            <Text style={styles.seasonValue}>{value}</Text>
            <Text style={styles.seasonLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const glow = (color: string) => ({ textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 });

const styles = StyleSheet.create({
  card: { alignSelf: "center", width: CARD_WIDTH, height: CARD_HEIGHT, paddingHorizontal: 34, paddingTop: 34 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", minHeight: 124 },
  rating: { alignItems: "center", minWidth: 68 },
  overall: { color: colors.lime, fontSize: 46, lineHeight: 50, fontWeight: "900", ...glow(colors.lime) },
  position: { color: colors.primary, fontSize: 20, fontWeight: "900", ...glow(colors.primary) },
  jersey: { color: colors.ink, fontSize: 11, fontWeight: "800", marginTop: 2 },
  photo: { width: 124, height: 124, borderRadius: 62 },
  initial: { color: colors.primary, fontSize: 96, lineHeight: 112, fontWeight: "900", marginRight: 22, ...glow(colors.primary) },
  name: { color: colors.ink, fontSize: 28, lineHeight: 31, fontWeight: "900", textAlign: "center", textTransform: "uppercase", marginTop: 4, ...glow(colors.primary) },
  foot: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 3 },
  stats: { flexDirection: "row", marginTop: 8, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(198,255,61,0.42)" },
  column: { flex: 1, alignItems: "center" },
  columnDivider: { borderRightWidth: 1, borderRightColor: "rgba(198,255,61,0.42)" },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  statValue: { color: colors.lime, fontSize: 18, lineHeight: 23, fontWeight: "900", minWidth: 16, textAlign: "right" },
  statCode: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  statTop: { color: colors.lime, ...glow(colors.lime) },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 14 },
  season: { flexDirection: "row", marginTop: 8 },
  seasonItem: { flex: 1, alignItems: "center" },
  seasonValue: { color: colors.primary, fontSize: 20, lineHeight: 23, fontWeight: "900" },
  seasonLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
});
