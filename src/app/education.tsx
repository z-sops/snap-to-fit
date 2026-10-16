import React, { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, colors } from "../components/ui";
import { EducationReminders } from "../components/EducationReminders";
import { useStore } from "../services/store";
import {
  articles,
  articlesIn,
  categories,
  searchArticles,
  topicsFor,
  verdicts,
  type Article,
  type LearnCategory,
} from "../core/learn";

const categoryLook: Record<LearnCategory, { emoji: string; tint: string }> = {
  danger: { emoji: "🚫", tint: "#FDECEC" },
  supplements: { emoji: "🧴", tint: "#EEF2FF" },
  body: { emoji: "💪", tint: "#E7F6EE" },
  fuel: { emoji: "🍽️", tint: "#FFF4DE" },
  conditions: { emoji: "🩺", tint: "#E9F6FF" },
  faq: { emoji: "❓", tint: "#F3EDFF" },
};

const learnNotice =
  "Education only, not medical advice. Talk to your doctor before starting any supplement, especially if you have a health condition, are under 18, or take medicines.";

export default function Education() {
  const [category, setCategory] = useState<LearnCategory | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const article = articles.find((a) => a.id === articleId) || null;
  const results = useMemo(() => (query.trim() ? searchArticles(query) : []), [query]);
  const profile = useStore().state.profile;
  const forYou = profile ? topicsFor(profile) : [];
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  useEffect(() => {
    // Deep link from Move/Home ("/education?topic=slip-disc") opens that topic once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (topic && articles.some((a) => a.id === topic)) setArticleId(topic);
  }, [topic]);

  if (article) {
    return (
      <Screen title={article.title} subtitle="Gym Truth" onBack={() => setArticleId(null)}
        backLabel={category ? "Back to list" : "Back to Gym Truth"}>
        <ArticleView article={article} />
      </Screen>
    );
  }

  if (category) {
    const meta = categories.find((c) => c.id === category)!;
    return (
      <Screen title={meta.label} subtitle={meta.detail} onBack={() => setCategory(null)} backLabel="Back to Gym Truth">
        {category === "supplements" ? <VerdictLegend /> : null}
        {articlesIn(category).map((a) => (
          <ArticleRow key={a.id} article={a} onPress={() => setArticleId(a.id)} />
        ))}
      </Screen>
    );
  }

  return (
    <Screen title="Gym Truth" subtitle="Build strength safely — the science, without the hype">
      <View style={s.hero}>
        <Text style={s.heroEmoji}>🏋️</Text>
        <Text style={s.heroTitle}>New to the gym?</Text>
        <Text style={s.heroText}>
          Real answers on steroids, water pills, supplements, soreness and food — from public health sources, with no brands and nothing to sell.
        </Text>
      </View>
      <View style={s.notice} accessibilityRole="alert">
        <Ionicons name="medkit-outline" size={18} color="#9A5B00" />
        <Text style={s.noticeText}>{learnNotice}</Text>
      </View>
      <TextInput
        accessibilityLabel="Search Gym Truth"
        placeholder="Search: creatine, soreness, protein…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={s.search}
      />
      {!query.trim() && forYou.length ? (
        <View style={{ gap: 10 }}>
          <Text style={s.forYou}>For you</Text>
          <Text style={s.muted}>Based on the age, health details and movement limits in your profile.</Text>
          {forYou.map((a) => <ArticleRow key={a.id} article={a} onPress={() => setArticleId(a.id)} />)}
        </View>
      ) : null}
      {query.trim() ? (
        results.length ? (
          results.map((a) => <ArticleRow key={a.id} article={a} onPress={() => setArticleId(a.id)} />)
        ) : (
          <Text style={s.muted}>No topics match “{query.trim()}”.</Text>
        )
      ) : (
        <View style={s.grid}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              onPress={() => setCategory(c.id)}
              style={[s.tile, { backgroundColor: categoryLook[c.id].tint }]}
            >
              <Text style={s.tileEmoji}>{categoryLook[c.id].emoji}</Text>
              <Text style={s.tileTitle}>{c.label}</Text>
              <Text style={s.tileDetail}>{c.detail}</Text>
              <Text style={s.tileCount}>{articlesIn(c.id).length} topics</Text>
            </Pressable>
          ))}
        </View>
      )}
      <EducationReminders />
    </Screen>
  );
}

function VerdictPill({ article }: { article: Article }) {
  const v = verdicts[article.verdict];
  return (
    <View style={[s.pill, { backgroundColor: v.bg }]}>
      <Text style={[s.pillText, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

function VerdictLegend() {
  return (
    <View style={s.legend}>
      {(["helpful", "food-first", "waste", "avoid"] as const).map((k) => (
        <View key={k} style={[s.pill, { backgroundColor: verdicts[k].bg }]}>
          <Text style={[s.pillText, { color: verdicts[k].color }]}>{verdicts[k].label}</Text>
        </View>
      ))}
    </View>
  );
}

function ArticleRow({ article, onPress }: { article: Article; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={article.title} onPress={onPress} style={s.row}>
      <Text style={s.rowEmoji}>{article.emoji}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.rowTitle}>{article.title}</Text>
        <VerdictPill article={article} />
        <Text style={s.rowSummary} numberOfLines={3}>{article.summary}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function ArticleView({ article }: { article: Article }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={s.detailHead}>
        <Text style={s.detailEmoji}>{article.emoji}</Text>
        <VerdictPill article={article} />
        <Text style={s.detailSummary}>{article.summary}</Text>
      </View>
      {article.sections.map((sec) => (
        <View key={sec.heading} style={s.section}>
          <Text style={s.sectionHeading}>{sec.heading}</Text>
          <Text style={s.sectionBody}>{sec.body}</Text>
        </View>
      ))}
      <View style={s.notice} accessibilityRole="alert">
        <Ionicons name="medkit-outline" size={18} color="#9A5B00" />
        <Text style={s.noticeText}>{article.caution ? `${article.caution} ` : ""}{learnNotice}</Text>
      </View>
      <View style={s.section}>
        <Text style={s.sectionHeading}>Sources</Text>
        {article.sources.map((src) => (
          <Pressable key={src.url} accessibilityRole="link" accessibilityLabel={src.title} onPress={() => Linking.openURL(src.url)}>
            <Text style={s.source}>{src.title} ↗</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.ink, borderRadius: 24, padding: 20, gap: 6 },
  heroEmoji: { fontSize: 34 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroText: { color: "#D6DCEA", fontSize: 15, lineHeight: 21 },
  notice: { flexDirection: "row", gap: 8, backgroundColor: "#FFF4DE", borderRadius: 14, padding: 12, alignItems: "flex-start" },
  noticeText: { flex: 1, color: "#6B4300", fontSize: 13, lineHeight: 18 },
  search: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  muted: { color: colors.muted, fontSize: 15 },
  forYou: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: "45%", borderRadius: 20, padding: 16, gap: 4, minHeight: 150 },
  tileEmoji: { fontSize: 30 },
  tileTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  tileDetail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  tileCount: { color: colors.green, fontSize: 13, fontWeight: "700", marginTop: "auto" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "800" },
  row: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14 },
  rowEmoji: { fontSize: 28 },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  rowSummary: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  detailHead: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  detailEmoji: { fontSize: 40 },
  detailSummary: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  section: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 6 },
  sectionHeading: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  sectionBody: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  source: { color: colors.green, fontSize: 14, lineHeight: 20, textDecorationLine: "underline" },
});
