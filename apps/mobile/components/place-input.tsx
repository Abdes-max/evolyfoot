import { colors, radii } from "@evolyfoot/design-tokens";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

const searchDelayMs = 300;
const minQueryLength = 3;

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Champ « Lieu » du web (place-input.tsx) : propose des adresses pendant la frappe, sans obliger à
// en choisir une -- un terrain annexe sans adresse se saisit librement.
export function PlaceInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { apiRequest } = useAuth();
  const [places, setPlaces] = useState<readonly string[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!typing || value.trim().length < minQueryLength) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await apiRequest(`/api/places?q=${encodeURIComponent(value.trim())}`);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled) {
        setPlaces(Array.isArray(body?.places) ? body.places : []);
      }
    }, searchDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiRequest, typing, value]);

  function choose(place: string) {
    onChange(place);
    setTyping(false);
    setPlaces([]);
  }

  return (
    <View>
      <TextInput
        accessibilityLabel="Lieu"
        onChangeText={(text) => {
          setTyping(true);
          if (text.trim().length < minQueryLength) {
            setPlaces([]);
          }
          onChange(text);
        }}
        placeholder="Stade, gymnase ou adresse"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />
      {typing && places.length > 0 && (
        <View style={styles.suggestions}>
          {places.map((place) => (
            <TouchableOpacity accessibilityRole="button" key={place} onPress={() => choose(place)} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{place}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {value.trim() && !(typing && places.length > 0) ? (
        <TouchableOpacity accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(mapsUrl(value.trim())).catch(() => undefined)}>
          <Text style={styles.map}>📍 Voir sur la carte</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink, marginTop: 8 },
  suggestions: { marginTop: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, overflow: "hidden" },
  suggestion: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  suggestionText: { fontSize: 13, color: colors.ink },
  map: { fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 8 },
});
