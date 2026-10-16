import React, { useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act, notify } from "../components/ui";
import { Surface, SectionHeader, Chip, PrimaryButton, Sheet, Pill, Bar, palette } from "../components/design";
import { Sparkline } from "../components/charts";
import { useStore } from "../services/store";
import { haptic } from "../services/feedback";
import { scheduleReminder, cancelReminder } from "../services/reminders";
import {
  daysUntil, doctorSummary, glp1Choices, glp1Week, injectionSites, isGlp1Name, labelWarnings, nextScheduled, nextSite,
  severityLabels, sideEffectAlerts, sideEffects, type InjectionSite, type SideEffectId,
} from "../core/glp1";
import { proteinGuidance } from "../core/targets";
import { mealsOn } from "../core/food-log";
import { uid, localDay, type Medicine } from "../core/model";

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const nextDays = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return localDay(d); });

const guides = [
  { id: "procedure", emoji: "🏥", title: "Before any procedure or surgery", text: "Tell the doctor and anesthesiologist you take a GLP-1 medicine. These medicines slow stomach emptying, which can raise the risk of food entering the lungs during anesthesia or deep sedation. They will tell you what to do before the procedure." },
  { id: "pregnancy", emoji: "🤰", title: "Planning a pregnancy", text: "Tell your prescriber if you are pregnant, breastfeeding or planning a pregnancy. Your Medication Guide explains what to discuss — Snap to Fit does not advise on stopping or timing." },
  { id: "sourcing", emoji: "🛡️", title: "Get your medicine safely", text: "Use an FDA-approved product from a state-licensed pharmacy with a prescription. The FDA has warned about counterfeit Ozempic and about compounded semaglutide and tirzepatide, which are not FDA-approved. Be wary of sites that sell without a prescription." },
  { id: "missed", emoji: "⏰", title: "Missed a dose?", text: "Follow the missed-dose instructions in your Medication Guide or ask your pharmacist. Snap to Fit does not calculate doses or change your schedule." },
  { id: "muscle", emoji: "💪", title: "Protect your muscle", text: "Weight loss on GLP-1 medicines can include muscle. Eat protein at every meal and do strength training at least twice a week — the Food and Move tabs track both." },
];

export default function Glp1Companion() {
  const { state, update } = useStore();
  const p = state.profile!;
  const glp1 = state.medicines.find((m) => isGlp1Name(m.name));
  const others = state.medicines.filter((m) => m !== glp1);
  const [setup, setSetup] = useState(false);
  const [logShot, setLogShot] = useState(false);
  const [checkin, setCheckin] = useState(false);
  const [addOther, setAddOther] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const week = glp1Week(state);
  const protein = proteinGuidance(p);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return mealsOn(state.meals, d); });
  const avgProtein = Math.round(last7.reduce((a, ms) => a + ms.reduce((x, m) => x + m.protein, 0), 0) / 7);
  const avgFiber = Math.round(last7.reduce((a, ms) => a + ms.reduce((x, m) => x + m.fibre, 0), 0) / 7);
  const strength = state.workouts.filter((w) => w.sets > 0 && new Date(w.at).getTime() > new Date().getTime() - 7 * 864e5);
  const strengthDays = new Set(strength.map((w) => localDay(w.at))).size;
  const weights = state.readings.filter((r) => r.kind === "weight").sort((a, b) => a.at.localeCompare(b.at)).slice(-20);
  const next = glp1 ? nextScheduled(glp1, state.doses) : null;
  const inDays = next ? daysUntil(next) : null;
  const injectable = glp1 ? glp1.kind !== "tablet" : true;
  const shots = state.doses.filter((d) => glp1 && d.medicineId === glp1.id).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Screen title="GLP-1 companion" subtitle="Shots, side effects, protein and muscle — in one place">
      <Surface dark>
        {glp1 ? (
          <>
            <Text style={s.darkLabel}>{glp1.name}</Text>
            <Text style={s.darkBig}>{inDays === null ? "—" : inDays <= 0 ? (inDays === 0 ? "Today" : `${-inDays} day${inDays === -1 ? "" : "s"} past`) : `In ${inDays} day${inDays === 1 ? "" : "s"}`}</Text>
            <Text style={s.darkText}>Next on your schedule: {fmtDate(next!)} at {glp1.time} · {glp1.dose}</Text>
            {injectable ? <Text style={s.darkText}>Next site to rotate to: {injectionSites.find((x) => x.id === nextSite(state.doses, glp1.id))?.label}</Text> : null}
            <PrimaryButton title={injectable ? "Log my shot" : "Log my dose"} icon="checkmark-circle" onPress={() => setLogShot(true)} />
          </>
        ) : (
          <>
            <Text style={s.darkBig}>Set up your GLP-1</Text>
            <Text style={s.darkText}>Copy your medicine, dose and day from your prescription. Snap to Fit reminds and records — your prescriber decides everything else.</Text>
            <PrimaryButton title="Add my GLP-1 medicine" icon="add-circle" onPress={() => setSetup(true)} />
          </>
        )}
      </Surface>

      <View style={s.row2}>
        <Pressable accessibilityRole="button" accessibilityLabel="How are you feeling? Log side effects" onPress={() => setCheckin(true)} style={s.action}>
          <Text style={s.actionEmoji}>🩺</Text>
          <Text style={s.actionTitle}>How do you feel?</Text>
          <Text style={s.actionText}>Log side effects</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share a summary with my doctor"
          onPress={() => act(async () => { await Share.share({ message: doctorSummary(state) }); })} style={s.action}>
          <Text style={s.actionEmoji}>📋</Text>
          <Text style={s.actionTitle}>Doctor summary</Text>
          <Text style={s.actionText}>Share 30 days</Text>
        </Pressable>
      </View>

      <Surface>
        <Text style={s.h}>This week</Text>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Protein (daily avg)</Text>
          <Text style={s.metricValue}>{avgProtein} g{protein ? ` / ${protein.low}–${protein.high} g` : ""}</Text>
        </View>
        <Bar value={avgProtein} total={protein?.low || 100} color={palette.protein} />
        <View style={s.metric}>
          <Text style={s.metricLabel}>Fiber (daily avg)</Text>
          <Text style={s.metricValue}>{avgFiber} / 28 g</Text>
        </View>
        <Bar value={avgFiber} total={28} color={palette.fiber} />
        <View style={s.metric}>
          <Text style={s.metricLabel}>Strength days</Text>
          <Text style={s.metricValue}>{strengthDays} / 2+</Text>
        </View>
        <Bar value={strengthDays} total={2} color={palette.brand} />
        <Text style={s.p}>
          {week.worst.length ? `Side effects logged: ${week.worst.slice(0, 3).map((w) => `${w.label} (${severityLabels[w.severity].toLowerCase()})`).join(", ")}.` : "No side effects logged this week."}
          {" "}Sip fluids through the day — nausea, vomiting and diarrhea can dehydrate you.
        </Text>
        {protein ? <Text style={s.small}>Protein range: {protein.perKg} — confirm with your doctor or dietitian.</Text> : <Text style={s.small}>Your care team sets your protein amount.</Text>}
      </Surface>

      {weights.length >= 2 ? (
        <Surface>
          <Text style={s.h}>Weight trend</Text>
          <Sparkline points={weights.map((w) => w.value)} color={palette.fat} />
          <Text style={s.p}>{shots.length} dose{shots.length === 1 ? "" : "s"} logged · tracking weight with your doses helps your doctor see what’s working.</Text>
        </Surface>
      ) : null}

      <Surface style={{ backgroundColor: palette.badSoft, borderColor: palette.badSoft }}>
        <Text style={[s.h, { color: palette.bad }]}>Call your doctor right away if you have</Text>
        {labelWarnings.map((w) => <Text key={w} style={s.warn}>• {w}</Text>)}
        <Text style={s.small}>From the US Medication Guides for GLP-1 medicines. Not a complete list — read the guide that came with your medicine.</Text>
      </Surface>

      <SectionHeader title="Good to know" />
      {guides.map((g) => (
        <Pressable key={g.id} accessibilityRole="button" aria-expanded={open === g.id} accessibilityLabel={g.title} onPress={() => setOpen(open === g.id ? null : g.id)} style={s.guide}>
          <View style={s.guideHead}>
            <Text style={s.guideEmoji}>{g.emoji}</Text>
            <Text style={s.guideTitle}>{g.title}</Text>
            <Ionicons name={open === g.id ? "chevron-up" : "chevron-down"} size={18} color={palette.muted} />
          </View>
          {open === g.id ? <Text style={s.p}>{g.text}</Text> : null}
        </Pressable>
      ))}

      {glp1 ? (
        <>
          <SectionHeader title="Dose history" />
          {shots.length === 0 ? <Text style={s.p}>No doses logged yet.</Text> : null}
          {shots.slice(0, 12).map((d) => (
            <View key={d.id} style={s.histRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.histTitle}>{new Date(d.at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {d.dose}</Text>
                <Text style={s.small}>{d.site ? injectionSites.find((x) => x.id === d.site)?.label : "No site recorded"}{d.symptoms ? ` · ${d.symptoms}` : ""}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Remove incorrect dose log" hitSlop={8} onPress={() => act(() => update((x) => ({ ...x, doses: x.doses.filter((y) => y.id !== d.id) })))}>
                <Ionicons name="trash-outline" size={18} color={palette.muted} />
              </Pressable>
            </View>
          ))}
          <Chip label="✏️ Edit my GLP-1 schedule" onPress={() => setSetup(true)} />
        </>
      ) : null}

      <SectionHeader title="Other medicines" action="Add" onAction={() => setAddOther(true)} />
      {others.length === 0 ? <Text style={s.p}>Add any other prescribed medicines for reminders and a complete doctor summary.</Text> : null}
      {others.map((m) => (
        <View key={m.id} style={s.histRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.histTitle}>{m.name}</Text>
            <Text style={s.small}>{m.dose} · {m.kind} · {m.frequency || "as prescribed"} · next {fmtDate(m.nextDate)} {m.time}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Record ${m.name} taken now`} hitSlop={8}
            onPress={() => act(async () => {
              await update((x) => ({ ...x, doses: [...x.doses, { id: uid(), at: new Date().toISOString(), medicineId: m.id, name: m.name, dose: m.dose, symptoms: "" }] }));
              haptic("success");
              notify("Recorded. This does not recommend taking another dose or changing your schedule.");
            })}>
            <Ionicons name="checkmark-circle-outline" size={24} color={palette.brand} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} hitSlop={8}
            onPress={() => act(async () => { if (m.reminderId) await cancelReminder(m.reminderId); await update((x) => ({ ...x, medicines: x.medicines.filter((y) => y.id !== m.id) })); })}>
            <Ionicons name="trash-outline" size={18} color={palette.muted} />
          </Pressable>
        </View>
      ))}
      <Text style={s.small}>Snap to Fit records what you enter. It never recommends a dose, a change, a break, stopping or tapering — those decisions belong to your prescriber.</Text>

      <MedicineSetup key={setup ? `glp1-${glp1?.id || "new"}` : `other-${String(addOther)}`} visible={setup || addOther} glp1Mode={setup} existing={setup ? glp1 : undefined} defaultName={setup ? p.glp1 : undefined}
        onClose={() => { setSetup(false); setAddOther(false); }}
        onSave={(m, remindAt) => act(async () => {
          let reminderId: string | undefined;
          if (remindAt) reminderId = await scheduleReminder(remindAt);
          const old = state.medicines.find((x) => x.id === m.id);
          if (old?.reminderId) await cancelReminder(old.reminderId);
          await update((x) => ({
            ...x,
            medicines: old ? x.medicines.map((y) => (y.id === m.id ? { ...m, reminderId } : y)) : [...x.medicines, { ...m, reminderId }],
            profile: x.profile && !old ? { ...x.profile, medicines: `${x.profile.medicines}\n${m.name} (${m.kind})`.trim(), insulin: x.profile.insulin || m.kind === "insulin" } : x.profile,
          }));
          setSetup(false); setAddOther(false);
        })} />
      {glp1 ? (
        <LogShot visible={logShot} medicine={glp1} suggested={nextSite(state.doses, glp1.id)} injectable={injectable}
          onClose={() => setLogShot(false)}
          onSave={(site, note) => act(async () => {
            const nextDate = nextScheduled({ ...glp1, nextDate: localDay() }, [{ id: "n", at: new Date().toISOString(), medicineId: glp1.id, name: glp1.name, dose: glp1.dose, symptoms: "" }]);
            await update((x) => ({
              ...x,
              doses: [...x.doses, { id: uid(), at: new Date().toISOString(), medicineId: glp1.id, name: glp1.name, dose: glp1.dose, symptoms: note, site }],
              medicines: x.medicines.map((m) => (m.id === glp1.id && glp1.frequency === "weekly" ? { ...m, nextDate } : m)),
            }));
            haptic("success");
            setLogShot(false);
            notify(glp1.frequency === "weekly" ? `Logged. Your weekly schedule now shows ${fmtDate(nextDate)} — change it if your prescriber said otherwise.` : "Logged.");
          })} />
      ) : null}
      <Checkin visible={checkin} onClose={() => setCheckin(false)} onInsulin={p.insulin}
        onSave={(effects, note) => act(async () => {
          await update((x) => ({ ...x, glp1Checkins: [...(x.glp1Checkins || []), { id: uid(), at: new Date().toISOString(), effects, note }] }));
          haptic("success");
          setCheckin(false);
        })} />
      <PrimaryButton title="Plan protein-rich meals" icon="restaurant" onPress={() => router.push("/food")} />
    </Screen>
  );
}

function MedicineSetup({ visible, glp1Mode, existing, defaultName, onClose, onSave }: {
  visible: boolean; glp1Mode: boolean; existing?: Medicine; defaultName?: string; onClose: () => void; onSave: (m: Medicine, remindAt?: Date) => void;
}) {
  const [name, setName] = useState(existing?.name || defaultName || "");
  const [dose, setDose] = useState(existing?.dose || "");
  const [kind, setKind] = useState<Medicine["kind"]>(existing?.kind || (glp1Mode ? "injection" : "tablet"));
  const [frequency, setFrequency] = useState<NonNullable<Medicine["frequency"]>>(existing?.frequency || (glp1Mode ? "weekly" : "daily"));
  const [date, setDate] = useState(existing?.nextDate || localDay());
  const [time, setTime] = useState(existing?.time || "09:00");
  const [remind, setRemind] = useState(true);
  return (
    <Sheet visible={visible} title={glp1Mode ? "My GLP-1 medicine" : "Add a medicine"} onClose={onClose}
      footer={<PrimaryButton title="Save" icon="checkmark" onPress={() => {
        if (!name.trim() || !dose.trim()) { notify("Enter the medicine name and the dose exactly as prescribed."); return; }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { notify("Use HH:MM for the time, e.g. 09:00."); return; }
        const when = new Date(`${date}T${time}:00`);
        onSave({ id: existing?.id || uid(), name: name.trim(), dose: dose.trim(), kind, time, nextDate: date, frequency }, remind && when.getTime() > new Date().getTime() ? when : undefined);
      }} />}>
      {glp1Mode ? (
        <>
          <Text style={s.h}>Which medicine?</Text>
          <View style={s.wrap}>{glp1Choices.map((c) => <Chip key={c} label={c} selected={name === c} onPress={() => { setName(c); setKind(/oral|pill|Rybelsus/i.test(c) ? "tablet" : "injection"); setFrequency(/liraglutide|Rybelsus|pill/i.test(c) ? "daily" : "weekly"); }} />)}</View>
        </>
      ) : (
        <>
          <TextInput value={name} onChangeText={setName} placeholder="Medicine name" placeholderTextColor={palette.muted} accessibilityLabel="Medication name" style={s.input} />
          <View style={s.wrap}>{(["tablet", "injection", "insulin"] as const).map((k) => <Chip key={k} label={k === "tablet" ? "Tablet" : k === "injection" ? "Injection" : "Insulin"} selected={kind === k} onPress={() => setKind(k)} />)}</View>
        </>
      )}
      <Text style={s.h}>Dose — copy it from your prescription</Text>
      <TextInput value={dose} onChangeText={setDose} placeholder="e.g. 0.5 mg" placeholderTextColor={palette.muted} accessibilityLabel="Prescribed dose (include units)" style={s.input} />
      <Text style={s.small}>Snap to Fit never suggests or changes doses.</Text>
      <Text style={s.h}>How often?</Text>
      <View style={s.wrap}>{(["weekly", "daily", "other"] as const).map((f) => <Chip key={f} label={f === "weekly" ? "Once a week" : f === "daily" ? "Every day" : "Other"} selected={frequency === f} onPress={() => setFrequency(f)} />)}</View>
      <Text style={s.h}>Next dose</Text>
      <View style={s.wrap}>{nextDays(8).map((d, i) => <Chip key={d} label={i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtDate(d)} selected={date === d} onPress={() => setDate(d)} />)}</View>
      <TextInput value={time} onChangeText={setTime} placeholder="Time (HH:MM)" placeholderTextColor={palette.muted} accessibilityLabel="Local time (HH:MM)" style={s.input} />
      <Chip label={remind ? "🔔 Remind me at this time" : "🔕 No reminder"} selected={remind} onPress={() => setRemind(!remind)} />
      <Text style={s.small}>Reminders can be delayed or missed by your phone. They are a convenience, not a guarantee.</Text>
    </Sheet>
  );
}

function LogShot({ visible, medicine, suggested, injectable, onClose, onSave }: {
  visible: boolean; medicine: Medicine; suggested: InjectionSite; injectable: boolean; onClose: () => void; onSave: (site: string | undefined, note: string) => void;
}) {
  const [site, setSite] = useState<InjectionSite>(suggested);
  const [note, setNote] = useState("");
  return (
    <Sheet visible={visible} title={injectable ? "Log my shot" : "Log my dose"} onClose={onClose}
      footer={<PrimaryButton title="Save" icon="checkmark" onPress={() => onSave(injectable ? site : undefined, note.trim())} />}>
      <Pill label={`${medicine.name} · ${medicine.dose}`} />
      {injectable ? (
        <>
          <Text style={s.h}>Where did you inject?</Text>
          <Text style={s.small}>Your Medication Guide says to change the site each time. Suggested: the one you used longest ago.</Text>
          <View style={s.body}>
            {injectionSites.map((x) => (
              <Pressable key={x.id} accessibilityRole="button" aria-selected={site === x.id} accessibilityLabel={x.label} onPress={() => setSite(x.id)}
                style={[s.site, site === x.id && s.siteOn]}>
                <Text style={[s.siteText, site === x.id && { color: "#fff" }]}>{x.label}</Text>
                {x.id === suggested ? <Text style={[s.siteHint, site === x.id && { color: "#DCE4FF" }]}>suggested</Text> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <TextInput value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={palette.muted} accessibilityLabel="Dose note" style={s.input} />
    </Sheet>
  );
}

function Checkin({ visible, onClose, onSave, onInsulin }: { visible: boolean; onClose: () => void; onSave: (e: Record<string, number>, note: string) => void; onInsulin: boolean }) {
  const [effects, setEffects] = useState<Partial<Record<SideEffectId, number>>>({});
  const [note, setNote] = useState("");
  const alerts = sideEffectAlerts(effects, onInsulin);
  return (
    <Sheet visible={visible} title="How are you feeling?" onClose={onClose}
      footer={<PrimaryButton title="Save check-in" icon="checkmark" onPress={() => { onSave(effects as Record<string, number>, note.trim()); setEffects({}); setNote(""); }} />}>
      {sideEffects.map((e) => (
        <View key={e.id} style={s.effect}>
          <Text style={s.effectName}>{e.emoji} {e.label}</Text>
          <View style={s.wrap}>
            {severityLabels.map((l, i) => <Chip key={l} label={l} selected={(effects[e.id] || 0) === i} onPress={() => setEffects({ ...effects, [e.id]: i })} />)}
          </View>
        </View>
      ))}
      {alerts.map((a) => (
        <View key={a.text} style={[s.alert, a.level === "urgent" && { backgroundColor: palette.badSoft }]} accessibilityRole="alert">
          <Text style={[s.alertText, a.level === "urgent" && { color: palette.bad }]}>{a.text}</Text>
        </View>
      ))}
      <TextInput value={note} onChangeText={setNote} placeholder="Anything else? (optional)" placeholderTextColor={palette.muted} accessibilityLabel="Check-in note" style={s.input} multiline />
      <Text style={s.small}>Most stomach side effects are mild and ease over time, but tell your doctor about anything that worries you. Snap to Fit can’t judge symptoms.</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  darkLabel: { color: "#A9B4CC", fontSize: 13, fontWeight: "700" },
  darkBig: { color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -0.6 },
  darkText: { color: "#C9D2E5", fontSize: 14, lineHeight: 20 },
  row2: { flexDirection: "row", gap: 10 },
  action: { flex: 1, backgroundColor: "#fff", borderRadius: 22, padding: 16, gap: 4, borderWidth: 1, borderColor: "#EDF0F6" },
  actionEmoji: { fontSize: 26 },
  actionTitle: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  actionText: { color: palette.muted, fontSize: 13 },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  p: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  small: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  metric: { flexDirection: "row", justifyContent: "space-between" },
  metricLabel: { color: palette.ink, fontSize: 14, fontWeight: "700" },
  metricValue: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  warn: { color: "#7A1B12", fontSize: 14, lineHeight: 20 },
  guide: { backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 8, borderWidth: 1, borderColor: "#EDF0F6" },
  guideHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  guideEmoji: { fontSize: 22 },
  guideTitle: { flex: 1, color: palette.ink, fontSize: 15, fontWeight: "800" },
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#EDF0F6" },
  histTitle: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: palette.ink },
  body: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  site: { width: "47%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 18, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: palette.line },
  siteOn: { backgroundColor: palette.brand, borderColor: palette.brand },
  siteText: { color: palette.ink, fontWeight: "800", fontSize: 15 },
  siteHint: { color: palette.brand, fontSize: 11, fontWeight: "700", marginTop: 2 },
  effect: { gap: 8, paddingVertical: 4 },
  effectName: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  alert: { backgroundColor: palette.warnSoft, borderRadius: 16, padding: 12 },
  alertText: { color: "#6B4300", fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
