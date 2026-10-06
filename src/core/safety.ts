export function urgentMessage(text: string): string | null {
  if (
    /chest (pain|pressure|tightness)|cannot breathe|can.t breathe|faint(ed|ing)?|unconscious|stroke|severe abdominal pain|vomiting blood/i.test(
      text,
    )
  )
    return "Stop exercising. These symptoms may require urgent medical attention. Contact your local emergency service now; do not wait for a chat response.";
  if (/\b(low (blood )?(sugar|glucose)|hypoglyc|sugar crash)/i.test(text))
    return "Pause activity, check your glucose if possible, and follow your prescribed low-glucose action plan. If you cannot safely swallow, are confused, faint, or symptoms are severe, get emergency help. Snap to Fit cannot adjust your insulin.";
  return null;
}
export function medicationRequest(text: string) {
  return (
    /\b(stop|skip|increase|decrease|change|reduce|taper|break|dose|units)\b/i.test(
      text,
    ) &&
    /\b(insulin|injection|ozempic|wegovy|mounjaro|medicine|medication|semaglutide|tirzepatide)\b/i.test(
      text,
    )
  );
}

export const doctorNotice =
  "Share this with your doctor. Apply these suggestions as advised by your doctor.";
export const steroidNotice =
  "Avoid non-prescribed anabolic steroids. Misuse can harm your heart, hormones, liver and kidneys. Do not change prescribed steroid medicines on your own.";
