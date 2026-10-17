import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLang, useT } from "../i18n";
import { countryName, searchCountries } from "../core/countries";
import { suggestedCountries } from "../core/regions";
import { Chip, palette } from "./design";

/** Every country can be chosen: suggested ones first, the rest by search in the user's language. */
export function CountryPicker({ value, onChange }: { value?: string; onChange: (code: string) => void }) {
  const tr = useT();
  const lang = useLang();
  const [query, setQuery] = useState("");
  const results = searchCountries(query, lang);
  const suggested = value && !suggestedCountries.includes(value) ? [value, ...suggestedCountries] : suggestedCountries;
  return (
    <View style={{ gap: 12 }}>
      <View style={s.chips}>
        {suggested.map((c) => (
          <Chip key={c} label={countryName(c, lang)} selected={value === c} onPress={() => { onChange(c); setQuery(""); }} />
        ))}
      </View>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={palette.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={tr("Search another country")} placeholderTextColor={palette.muted}
          accessibilityLabel={tr("Search another country")} autoCorrect={false} style={s.input} />
      </View>
      {results.map((c) => (
        <Pressable key={c.code} accessibilityRole="button" aria-selected={value === c.code} accessibilityLabel={c.name}
          onPress={() => { onChange(c.code); setQuery(""); }} style={[s.row, value === c.code && s.rowOn]}>
          <Text style={s.rowText}>{c.name}</Text>
          {value === c.code ? <Ionicons name="checkmark-circle" size={20} color={palette.brand} /> : null}
        </Pressable>
      ))}
      {query.trim() && !results.length ? <Text style={s.empty}>{tr("No country matches that name.")}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, borderRadius: 16, paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 48, color: palette.ink, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line },
  rowOn: { borderColor: palette.brand },
  rowText: { color: palette.ink, fontSize: 16, fontWeight: "600", flexShrink: 1 },
  empty: { color: palette.muted, fontSize: 14 },
});
