import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { demoFocus, nextSession } from "@evolyfoot/domain";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../lib/auth-context";

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default function HomeScreen() {
  const { educator, team, logout } = useAuth();
  const firstName = educator?.displayName.split(" ")[0] ?? "";

  function confirmLogout() {
    Alert.alert("Se déconnecter ?", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>LUNDI 17 AOÛT</Text>
            <Text style={styles.title}>Bonjour {firstName},</Text>
            <Text style={styles.subtitle}>{team ? `${team.name} · ${team.ageGroup}` : "Pas encore d’équipe"}</Text>
          </View>
          <TouchableOpacity accessibilityLabel="Se déconnecter" onPress={confirmLogout} style={styles.avatar}>
            <Text style={styles.avatarText}>{educator ? initials(educator.displayName) : "?"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.focusCard}>
          <Text style={styles.focusEyebrow}>PRIORITÉ DU CYCLE · SEMAINE 3/4</Text>
          <Text style={styles.focusTitle}>{demoFocus.label}</Text>
          <Text style={styles.focusBody}>Faire émerger davantage de soutien proche et de solutions devant le ballon.</Text>
          <View style={styles.progress}>
            <View style={[styles.progressValue, { width: `${demoFocus.progress}%` }]} />
          </View>
          <View style={styles.row}>
            <Text style={styles.focusMeta}>
              {demoFocus.sessionsCompleted}/{demoFocus.sessionsTotal} séances
            </Text>
            <Text style={styles.focusMeta}>{demoFocus.progress}%</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Prochaine séance</Text>
        <View style={styles.sessionCard}>
          <View style={styles.row}>
            <Text style={styles.eyebrow}>{nextSession.dateLabel.toUpperCase()}</Text>
            <Text style={styles.chip}>{nextSession.intensity}</Text>
          </View>
          <Text style={styles.cardTitle}>{nextSession.title}</Text>
          <Text style={styles.cardBody}>
            {nextSession.durationMinutes} min · {nextSession.playerCount} joueurs · Jeu de position
          </Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Ouvrir la séance</Text>
            <Text style={styles.buttonText}>→</Text>
          </TouchableOpacity>
        </View>

        <Link href="/observation?type=match" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Observer un match</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <View style={styles.suggestion}>
          <View style={styles.suggestionContent}>
            <Text style={styles.eyebrow}>SUGGESTION EVOLY</Text>
            <Text style={styles.suggestionTitle}>Garde le thème, change la contrainte.</Text>
            <Text style={styles.cardBody}>Réduis l&apos;espace mardi pour provoquer des décisions plus rapides.</Text>
          </View>
        </View>

        <Link href="/onboarding" asChild>
          <TouchableOpacity style={styles.setupButton}>
            <Text style={styles.setupText}>{team ? "Modifier mon équipe" : "Configurer mon équipe"}</Text>
            <Text style={styles.setupText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/equipe" asChild>
          <TouchableOpacity style={styles.setupButton}>
            <Text style={styles.setupText}>Gérer l’effectif</Text>
            <Text style={styles.setupText}>→</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.paper},page:{padding:spacing.lg,paddingBottom:48},header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:spacing.xl},eyebrow:{fontSize:10,letterSpacing:1.2,fontWeight:"800",color:colors.muted},title:{fontSize:28,fontWeight:"800",color:colors.ink,marginTop:6},subtitle:{fontSize:13,color:colors.muted,marginTop:4},avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},avatarText:{color:colors.primary,fontSize:11,fontWeight:"800"},focusCard:{padding:spacing.lg,borderRadius:radii.lg,backgroundColor:colors.primaryDark,borderWidth:1,borderColor:colors.line},focusEyebrow:{fontSize:9,letterSpacing:1,color:colors.muted,fontWeight:"800"},focusTitle:{fontSize:23,lineHeight:29,fontWeight:"800",color:colors.ink,marginTop:24},focusBody:{fontSize:12,lineHeight:19,color:colors.muted,marginTop:10},progress:{height:6,borderRadius:3,backgroundColor:"rgba(255,255,255,.08)",marginTop:24,overflow:"hidden"},progressValue:{height:6,backgroundColor:colors.primary,borderRadius:3},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},focusMeta:{fontSize:10,color:colors.muted,marginTop:10},sectionTitle:{fontSize:18,fontWeight:"800",color:colors.ink,marginTop:32,marginBottom:14},sessionCard:{padding:spacing.lg,backgroundColor:colors.surface,borderRadius:radii.md,borderWidth:1,borderColor:colors.line},chip:{fontSize:9,fontWeight:"800",color:colors.primary,backgroundColor:colors.primarySoft,paddingVertical:6,paddingHorizontal:9,borderRadius:radii.pill},cardTitle:{fontSize:20,fontWeight:"800",color:colors.ink,marginTop:20},cardBody:{fontSize:12,lineHeight:18,color:colors.muted,marginTop:8},button:{minHeight:44,marginTop:22,padding:14,backgroundColor:colors.primary,borderRadius:radii.sm,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},buttonText:{fontSize:11,fontWeight:"800",color:colors.primaryInk},observationButton:{minHeight:44,marginTop:16,padding:14,backgroundColor:colors.primarySoft,borderColor:colors.primary,borderWidth:1,borderRadius:radii.sm,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},observationText:{fontSize:11,fontWeight:"800",color:colors.primary},suggestion:{flexDirection:"row",gap:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,padding:spacing.md,borderRadius:radii.md,marginTop:16},suggestionContent:{flex:1},suggestionTitle:{fontSize:14,fontWeight:"800",color:colors.ink,marginTop:5},setupButton:{minHeight:44,marginTop:16,padding:15,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:radii.sm,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},setupText:{color:colors.ink,fontSize:11,fontWeight:"800"}
});
