import React from "react";
import { Chips, Check, H, P } from "./ui";
import type { Profile } from "../core/model";
export const weekdays = [
  { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }, { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];
export function WorkoutPreferences({ profile, onChange }: { profile: Profile; onChange: (profile: Profile) => void }) {
  const selected = profile.workoutDays || [];
  return <>
    <H>Your workout week</H>
    <P>How many days would you like to work out each week?</P>
    <Chips values={[1,2,3,4,5,6,7].map(value => ({ value, label: String(value) }))}
      selected={profile.days} onChange={days => onChange({ ...profile, days, workoutDays: undefined })}/>
    <P>Choose your own days: {selected.length} of {profile.days} selected. The app does not assign alternate days. Adjust training and recovery to your capacity and existing care plan.</P>
    {weekdays.map(day => <Check key={day.value} label={day.label} value={selected.includes(day.value)}
      onChange={checked => onChange({ ...profile, workoutDays: checked ? [...selected, day.value] : selected.filter(d => d !== day.value) })}/>)}
  </>;
}
