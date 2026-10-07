import {
  weeklySchedule,
  progressionSuggestion,
  isRestricted,
} from "../core/schedule";
import { router } from "expo-router";
import { MusicControls } from "../components/MusicControls";
import { WorkoutPreferences } from "../components/WorkoutPreferences";
import React, { useState, useEffect } from "react";
import {
  Screen,
  Card,
  H,
  P,
  Chips,
  Field,
  Button,
  Row,
  Metric,
  act,
} from "../components/ui";
import { Movement } from "../components/Movement";
import { useStore } from "../services/store";
import { exercises, lastPerformance } from "../core/workouts";
import { uid, numeric, validateProfile, type Place, localDay } from "../core/model";
export default function Move() {
  const { state, update } = useStore();
  const p = state.profile!;
  const [editingWeek, setEditingWeek] = useState(!p.workoutDays);
  const [weekProfile, setWeekProfile] = useState(p);
  const [place, setPlace] = useState<Place>(p.place);
  const [index, setIndex] = useState(0);
  const [sets, setSets] = useState("2");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState(0);
  const week = weeklySchedule(p, state.workouts, place);
  const [selectedDate, setSelectedDate] = useState(localDay());
  const scheduled = week.find((d) => d.date === selectedDate) || week[0];
  const items =
    scheduled.items.length && !scheduled.restricted
      ? scheduled.items
      : exercises.filter((e) => e.place.includes(place));
  const plan = {
    ...scheduled,
    items,
    note: scheduled.restricted
      ? "Use your existing care plan. Individual exercise intensity is not assigned."
      : scheduled.rest
        ? "You have not scheduled a workout for this day. The exercise library is available to review or log any activity you choose."
        : "Your planned session. Warm up gently and use comfortable loads.",
  };
  const exercise = plan.items[index % plan.items.length];
  const last = lastPerformance(state.workouts, exercise.id);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((x) => Math.max(0, x - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return (
    <Screen
      title="Make time to move."
      subtitle={`${p.days} preferred sessions per week · ${p.experience}`}
    >
      <Button secondary title="Choose workout music" onPress={() => router.push("/music")} />
      <MusicControls />
      <Card>
        <Button secondary title={editingWeek ? "Close week settings" : "Choose / change my workout days"}
          onPress={() => { setWeekProfile(p); setEditingWeek(!editingWeek); }}/>
        {editingWeek ? <>
          <WorkoutPreferences profile={weekProfile} onChange={setWeekProfile}/>
          <Button title="Save my workout week" onPress={() => act(async () => {
            if (!weekProfile.workoutDays) throw new Error("Choose your workout days first.");
            validateProfile(weekProfile);
            await update(s => ({ ...s, profile: s.profile ? { ...s.profile, days: weekProfile.days, workoutDays: weekProfile.workoutDays } : null }));
            setEditingWeek(false); setIndex(0);
          })}/>
        </> : null}
      </Card>
      <Chips
        values={[
          { value: "gym", label: "Gym" },
          { value: "home", label: "Home" },
          { value: "walk", label: "Walking" },
        ]}
        selected={place}
        onChange={(v) => {
          setPlace(v);
          setIndex(0);
        }}
      />
      <Card>
        <H>This week</H>
        <Chips
          values={week.map((d) => ({
            value: d.date,
            label: `${d.weekday}${d.completed ? " ✓" : ""}${d.rest ? " · Off" : ""}`,
          }))}
          selected={selectedDate}
          onChange={(v) => {
            setSelectedDate(v);
            setIndex(0);
          }}
        />
        <P>
          {week.filter((d) => !d.rest).length} planned training days, with
          only on the days you selected. A check mark means an exercise was logged that
          day.
        </P>
      </Card>
      <Card tint>
        <H>{plan.title}</H>
        <P>{plan.note}</P>
        <P>
          You control this calendar. Unselected days are not compulsory rest
          days. Plan suitable recovery around your activities and care plan.
        </P>
      </Card>
      <Card>
        <Chips
          values={plan.items.map((e, i) => ({ value: i, label: e.name }))}
          selected={index % plan.items.length}
          onChange={setIndex}
        />
        <H>{exercise.name}</H>
        <P>
          {exercise.muscle} · {exercise.equipment}
        </P>
        <Movement motion={exercise.motion} />
        <P>
          Prototype animation illustrates the movement pattern. It is not a
          validated form assessment or a substitute for learning the movement
          safely.
        </P>
        {exercise.cues.map((c) => (
          <P key={c}>• {c}</P>
        ))}
        {!plan.restricted && !plan.rest && place !== "walk" ? (
          <P>
            Planned suggestion: {plan.sets} sets × {plan.reps} reps, using a
            comfortable load.
          </P>
        ) : null}
        <P>
          {!isRestricted(p)
            ? progressionSuggestion(state.workouts, exercise.id)
            : "Follow your existing care plan for progression."}
        </P>
        {last ? (
          <P>
            Last logged: {last.sets} sets × {last.reps} reps · {last.weight} kg
            · {last.minutes} min. Increase only when form and recovery support
            it.
          </P>
        ) : (
          <P>No previous performance logged.</P>
        )}
        <H>Record what you completed</H>
        {place !== "walk" ? (
          <>
            <Field
              label="Sets completed (0 for holds/cardio)"
              numeric
              value={sets}
              onChange={setSets}
            />
            <Field
              label="Reps per set"
              numeric
              value={reps}
              onChange={setReps}
            />
            <Field
              label="Weight used (kg; 0 for bodyweight)"
              numeric
              value={weight}
              onChange={setWeight}
            />
          </>
        ) : null}
        <Field
          label="Duration (minutes)"
          numeric
          value={minutes}
          onChange={setMinutes}
        />
        <Button
          title="Save exercise entry"
          onPress={() =>
            act(async () => {
              const entry = {
                id: uid(),
                at: new Date().toISOString(),
                exerciseId: exercise.id,
                name: exercise.name,
                sets: place === "walk" ? 0 : numeric(sets, 0, 30, "Sets"),
                reps: place === "walk" ? 0 : numeric(reps, 0, 100, "Reps"),
                weight:
                  place === "walk" ? 0 : numeric(weight, 0, 500, "Weight"),
                minutes: numeric(minutes, 1, 240, "Duration"),
              };
              await update((s) => ({ ...s, workouts: [...s.workouts, entry] }));
              setMinutes("");
            })
          }
        />
      </Card>
      <Card>
        <H>Rest timer</H>
        <Row>
          <Metric label="Seconds remaining" value={seconds} />
        </Row>
        <Row>
          <Button title="Start 60 seconds" onPress={() => setSeconds(60)} />
          <Button secondary title="Stop timer" onPress={() => setSeconds(0)} />
        </Row>
      </Card>
      <Card>
        <H>Recent sessions</H>
        {[...state.workouts]
          .reverse()
          .slice(0, 10)
          .map((w) => (
            <Card key={w.id}>
              <P>
                {w.name} · {w.minutes} min ·{" "}
                {new Date(w.at).toLocaleDateString()}
              </P>
              <Button
                secondary
                title="Remove exercise entry"
                onPress={() =>
                  act(() =>
                    update((s) => ({
                      ...s,
                      workouts: s.workouts.filter((x) => x.id !== w.id),
                    })),
                  )
                }
              />
            </Card>
          ))}
      </Card>
    </Screen>
  );
}
