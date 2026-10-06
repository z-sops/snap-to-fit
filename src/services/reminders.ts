export async function scheduleReminder(_date: Date): Promise<string> {
  throw new Error(
    "Medication reminders require an Android or iPhone device build.",
  );
}
export async function cancelReminder(_id: string): Promise<void> {}
