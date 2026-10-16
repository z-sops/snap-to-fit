import { useT } from "../i18n";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import { useMenuInsets } from "./menu-insets";
import { musicTime } from "../core/music";
import * as deviceAudio from "../services/device-audio";
import type { DeviceTrack } from "../services/device-audio-types";

type Source = Pick<typeof deviceAudio, "deviceAudioPermission" | "listDeviceAudio">;

type Phase =
  | { kind: "loading" }
  | { kind: "denied"; canAskAgain: boolean }
  | { kind: "ready"; tracks: DeviceTrack[] }
  | { kind: "error"; message: string };

/**
 * Full-screen song list inside Snap to Fit. Unlike the system Files picker it
 * always has a Back button, and Android Back closes it.
 */
export function DeviceAudioPicker({
  open,
  onClose,
  onPick,
  source = deviceAudio,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (track: DeviceTrack) => void;
  source?: Source;
}) {
  const insets = useMenuInsets();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [filter, setFilter] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const perm = await source.deviceAudioPermission(true);
        if (!active) return;
        if (!perm.granted) {
          setPhase({ kind: "denied", canAskAgain: perm.canAskAgain });
          return;
        }
        const tracks = await source.listDeviceAudio();
        if (active) setPhase({ kind: "ready", tracks });
      } catch (e) {
        if (active)
          setPhase({ kind: "error", message: e instanceof Error ? e.message : "Could not read songs." });
      }
    })();
    return () => {
      active = false;
    };
  }, [open, attempt, source]);

  const shown = useMemo(() => {
    if (phase.kind !== "ready") return [];
    const q = filter.trim().toLowerCase();
    return q ? phase.tracks.filter((t) => t.name.toLowerCase().includes(q)) : phase.tracks;
  }, [phase, filter]);

  const close = () => {
    setFilter("");
    setPhase({ kind: "loading" });
    onClose();
  };
  const retry = () => {
    setPhase({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  if (!open) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={st.head}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Back to Snap to Fit" hitSlop={8} style={st.back}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
            <Text style={st.backText}>Back</Text>
          </Pressable>
          <Text style={st.title} accessibilityRole="header">Choose a song</Text>
          <View style={{ width: 72 }} />
        </View>

        {phase.kind === "ready" && phase.tracks.length > 0 ? (
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Search your songs"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search your songs"
            style={st.search}
          />
        ) : null}

        {phase.kind === "loading" ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={colors.green} />
            <Text style={st.note}>Looking for songs on this phone…</Text>
          </View>
        ) : null}

        {phase.kind === "denied" ? (
          <View style={st.center}>
            <Ionicons name="musical-notes-outline" size={40} color={colors.green} />
            <Text style={st.heading}>Allow access to your music</Text>
            <Text style={st.note}>
              Snap to Fit needs the “Music and audio” permission to list songs on this phone.
              Songs stay on your phone and are not uploaded.
            </Text>
            {phase.canAskAgain ? (
              <Btn label="Allow access" onPress={retry} />
            ) : (
              <Btn label="Open phone settings" onPress={() => void Linking.openSettings()} />
            )}
            <Btn label="Back to Music" secondary onPress={close} />
          </View>
        ) : null}

        {phase.kind === "error" ? (
          <View style={st.center}>
            <Text style={st.heading}>Could not load your songs</Text>
            <Text style={st.note}>{phase.message}</Text>
            <Btn label="Try again" onPress={retry} />
            <Btn label="Back to Music" secondary onPress={close} />
          </View>
        ) : null}

        {phase.kind === "ready" && phase.tracks.length === 0 ? (
          <View style={st.center}>
            <Text style={st.heading}>No songs found on this phone</Text>
            <Text style={st.note}>Songs saved on this phone (for example downloaded MP3 or M4A files) appear here.</Text>
            <Btn label="Check again" onPress={retry} />
          </View>
        ) : null}

        {phase.kind === "ready" && phase.tracks.length > 0 ? (
          <FlatList
            data={shown}
            keyExtractor={(t) => t.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={<Text style={st.note}>No songs match “{filter}”.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { close(); onPick(item); }}
                accessibilityRole="button"
                accessibilityLabel={`Play ${item.name}`}
                style={st.row}
              >
                <View style={st.icon}>
                  <Ionicons name="musical-note" size={18} color={colors.green} />
                </View>
                <Text style={st.name} numberOfLines={2}>{item.name.replace(/\.[a-z0-9]{2,4}$/i, "")}</Text>
                {item.durationMs ? <Text style={st.time}>{musicTime(item.durationMs / 1000)}</Text> : null}
              </Pressable>
            )}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function Btn({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) {
  const tr = useT();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={secondary ? st.btnSecondary : st.btn}>
      <Text style={secondary ? st.btnSecondaryText : st.btnText}>{tr(label)}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.line },
  back: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, width: 72 },
  backText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  search: { margin: 16, marginBottom: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, minHeight: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  heading: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center" },
  note: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: "center", marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  time: { fontSize: 13, color: colors.muted },
  btn: { backgroundColor: colors.green, borderRadius: 15, minHeight: 50, paddingHorizontal: 22, justifyContent: "center", alignSelf: "stretch", alignItems: "center" },
  btnText: { color: "white", fontWeight: "700", fontSize: 15 },
  btnSecondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 15, minHeight: 50, paddingHorizontal: 22, justifyContent: "center", alignSelf: "stretch", alignItems: "center" },
  btnSecondaryText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
});
