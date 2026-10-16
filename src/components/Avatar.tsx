import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet, Chip, PrimaryButton, palette } from "./design";
import type { Profile } from "../core/model";

export const avatarEmojis = ["🦁", "🐯", "🦊", "🐼", "🐨", "🐸", "🦄", "🐙", "🦖", "🚀", "⚡", "🔥", "🌱", "🏋️", "🏃", "🧘", "🥑", "🍓", "😎", "🤩"];
export const avatarColors = ["#355AF4", "#F26B5B", "#F2B63D", "#7C5CF2", "#34B37A", "#111A2E", "#EC4899", "#0EA5E9"];

export function Avatar({ profile, size = 48, onPress }: { profile: Pick<Profile, "name" | "avatar">; size?: number; onPress?: () => void }) {
  const a = profile.avatar || {};
  const bg = a.color || palette.brand;
  const body = a.photoUri ? (
    <Image source={{ uri: a.photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ fontSize: a.emoji ? size * 0.5 : size * 0.42, color: "#fff", fontWeight: "800" }}>
        {a.emoji || (profile.name.trim()[0] || "?").toUpperCase()}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel="Change your avatar" onPress={onPress} hitSlop={6}>{body}</Pressable>;
}

export function AvatarPicker({ visible, profile, onClose, onSave, onPickPhoto }: {
  visible: boolean; profile: Profile; onClose: () => void; onSave: (a: Profile["avatar"]) => void; onPickPhoto: () => void;
}) {
  const [emoji, setEmoji] = React.useState(profile.avatar?.emoji);
  const [color, setColor] = React.useState(profile.avatar?.color || avatarColors[0]);
  return (
    <Sheet visible={visible} title="Your avatar" onClose={onClose}
      footer={<PrimaryButton title="Save avatar" icon="checkmark" onPress={() => onSave({ emoji, color })} />}>
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Avatar profile={{ name: profile.name, avatar: { emoji, color } }} size={112} />
      </View>
      <Text style={s.h}>Pick a vibe</Text>
      <View style={s.grid}>
        <Pressable accessibilityRole="button" accessibilityLabel="Use my initial" onPress={() => setEmoji(undefined)} style={[s.cell, !emoji && s.cellOn]}>
          <Text style={s.initial}>{(profile.name.trim()[0] || "?").toUpperCase()}</Text>
        </Pressable>
        {avatarEmojis.map((e) => (
          <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Avatar ${e}`} onPress={() => setEmoji(e)} style={[s.cell, emoji === e && s.cellOn]}>
            <Text style={{ fontSize: 28 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.h}>Colour</Text>
      <View style={s.grid}>
        {avatarColors.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Colour ${c}`} onPress={() => setColor(c)}
            style={[s.swatch, { backgroundColor: c }, color === c && { borderColor: palette.ink, borderWidth: 3 }]} />
        ))}
      </View>
      <Chip label="📷  Use a photo instead" onPress={onPickPhoto} />
      <Text style={s.note}>Your photo stays on this phone.</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: 56, height: 56, borderRadius: 18, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  cellOn: { borderColor: palette.brand, backgroundColor: palette.brandSoft },
  initial: { fontSize: 24, fontWeight: "800", color: palette.ink },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#fff" },
  note: { color: palette.muted, fontSize: 12 },
});
